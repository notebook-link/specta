// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
const path = require('path');
const fs = require('fs-extra');
const rspack = require('@rspack/core');
const merge = require('webpack-merge').default;

const { ModuleFederationPluginV1: ModuleFederationPlugin } = rspack.container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Handlebars = require('handlebars');
const Build = require('@jupyter/builder').Build;
const baseConfig = require('@jupyter/builder/lib/webpack.config.base');

const topLevelData = require('../package.json');

const liteAppData = topLevelData.jupyterlite.apps.reduce(
  (memo, app) => ({ ...memo, [app]: require(`./${app}/package.json`) }),
  {}
);

// custom handlebars helper to check if a page corresponds to a value
Handlebars.registerHelper('ispage', (key, page) => {
  return key === page;
});

/**
 * Create the webpack ``shared`` configuration
 *
 * Successive apps' merged data are joined
 */
function createShared(packageData, shared = null) {
  // Set up module federation sharing config
  shared = shared || {};
  const extensionPackages = packageData.jupyterlab.extensions;

  // Make sure any resolutions are shared
  for (let [pkg, requiredVersion] of Object.entries(packageData.resolutions)) {
    shared[pkg] = { requiredVersion };
  }

  // Add any extension packages that are not in resolutions (i.e., installed from npm)
  for (let pkg of extensionPackages) {
    if (!shared[pkg]) {
      shared[pkg] = {
        requiredVersion: require(`${pkg}/package.json`).version
      };
    }
  }

  // Add dependencies and sharedPackage config from extension packages if they
  // are not already in the shared config. This means that if there is a
  // conflict, the resolutions package version is the one that is shared.
  const extraShared = [];
  for (let pkg of extensionPackages) {
    let pkgShared = {};
    let {
      dependencies = {},
      jupyterlab: { sharedPackages = {} } = {}
    } = require(`${pkg}/package.json`);
    for (let [dep, requiredVersion] of Object.entries(dependencies)) {
      if (!shared[dep]) {
        pkgShared[dep] = { requiredVersion };
      }
    }

    // Overwrite automatic dependency sharing with custom sharing config
    for (let [dep, config] of Object.entries(sharedPackages)) {
      if (config === false) {
        delete pkgShared[dep];
      } else {
        if ('bundled' in config) {
          config.import = config.bundled;
          delete config.bundled;
        }
        pkgShared[dep] = config;
      }
    }
    extraShared.push(pkgShared);
  }

  // Now merge the extra shared config
  const mergedShare = {};
  for (let sharedConfig of extraShared) {
    for (let [pkg, config] of Object.entries(sharedConfig)) {
      // Do not override the basic share config from resolutions
      if (shared[pkg]) {
        continue;
      }

      // Add if we haven't seen the config before
      if (!mergedShare[pkg]) {
        mergedShare[pkg] = config;
        continue;
      }

      // Choose between the existing config and this new config. We do not try
      // to merge configs, which may yield a config no one wants
      let oldConfig = mergedShare[pkg];

      // if the old one has import: false, use the new one
      if (oldConfig.import === false) {
        mergedShare[pkg] = config;
      }
    }
  }

  Object.assign(shared, mergedShare);

  // Transform any file:// requiredVersion to the version number from the
  // imported package. This assumes (for simplicity) that the version we get
  // importing was installed from the file.
  for (let [pkg, { requiredVersion }] of Object.entries(shared)) {
    if (requiredVersion && requiredVersion.startsWith('file:')) {
      shared[pkg].requiredVersion = require(`${pkg}/package.json`).version;
    }
  }

  // Add singleton package information
  for (let pkg of packageData.jupyterlab.singletonPackages) {
    if (shared[pkg]) {
      shared[pkg].singleton = true;
    }
  }

  return shared;
}

const topLevelBuild = path.resolve('../specta/app_static/build');
const spectaAssets = path.resolve('../specta/app_static/specta');
if (!fs.existsSync(spectaAssets)) {
  fs.mkdirSync(spectaAssets, { recursive: true });
}

['jupyter-lite.json', 'jupyter-lite.ipynb', 'package.json'].forEach(f => {
  fs.copyFileSync(path.resolve('./specta', f), path.join(spectaAssets, f));
});

const allAssetConfig = [];
const allEntryPoints = {};
const allHtmlPlugins = [];

for (const [name, data] of Object.entries(liteAppData)) {
  const buildDir = path.join(name, 'build');

  const packageNames = data.jupyterlab.extensions;
  // Generate webpack config to copy extension assets to the build directory,
  // such as setting schema files, theme assets, etc.
  const extensionAssetConfig = Build.ensureAssets({
    packageNames,
    output: buildDir,
    schemaOutput: topLevelBuild,
    themeOutput: topLevelBuild
  });

  allAssetConfig.push(extensionAssetConfig);

  // Create a list of application extensions and mime extensions from
  // jlab.extensions
  const extensions = {};
  const mimeExtensions = {};
  for (const key of packageNames) {
    const {
      jupyterlab: { extension, mimeExtension }
    } = require(`${key}/package.json`);
    if (extension !== undefined) {
      extensions[key] = extension === true ? '' : extension;
    }
    if (mimeExtension !== undefined) {
      mimeExtensions[key] = mimeExtension === true ? '' : mimeExtension;
    }
  }
  // Retrieve app info from package.json
  const { appClassName, appModuleName, disabledExtensions } = data.jupyterlab;

  // Create the entry point and other assets in build directory.
  const template = Handlebars.compile(
    fs.readFileSync(path.resolve('./index.template.js')).toString()
  );
  fs.writeFileSync(
    path.join(name, 'build', 'index.js'),
    template({
      name,
      appClassName,
      appModuleName,
      extensions,
      mimeExtensions,
      disabledExtensions
    })
  );

  // Copy source to build directory
  fs.copySync('../lib', buildDir);
  fs.copySync('../style', path.join(buildDir, 'style'));

  // Create the bootstrap file that loads federated extensions and calls the
  // initialization logic in index.js
  const entryPoint = `./${name}/build/bootstrap.js`;
  fs.copySync('bootstrap.js', entryPoint);
  // Copy the publicpath file
  const publicPath = `./${name}/build/publicpath.js`;
  fs.copySync('publicpath.js', publicPath);
  allEntryPoints[`${name}/bundle`] = entryPoint;
  allEntryPoints[`${name}/publicpath`] = publicPath;

  // Inject the name of the app in the template to be able to filter bundle files
  const indexTemplate = Handlebars.compile(
    fs.readFileSync(path.resolve('./index.template.html')).toString()
  );
  fs.writeFileSync(
    path.join(name, 'build', 'index.template.html'),
    indexTemplate({
      name
    })
  );
  // Use templates to create cache-busting templates
  allHtmlPlugins.push(
    new HtmlWebpackPlugin({
      inject: false,
      minify: false,
      title: data.jupyterlab.title,
      filename: `../${name}/index.html`,
      template: `${name}/build/index.template.html`
    })
  );
}
const shared = Object.values(liteAppData).reduce(
  (memo, data) => createShared(data, memo),
  {}
);

const isProduction = process.env.NODE_ENV === 'production';
module.exports = [
  merge(baseConfig, {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'source-map',
    entry: allEntryPoints,
    resolve: {
      fallback: {
        util: false
      }
    },
    output: {
      path: topLevelBuild,
      library: {
        type: 'var',
        name: ['_JUPYTERLAB', 'CORE_OUTPUT']
      },
      filename: '[name].js?_=[contenthash:7]',
      chunkFilename: '[name].[contenthash:7].js',
      // to generate valid wheel names
      assetModuleFilename: '[name][ext][query]'
    },
    experiments: {
      cache: {
        type: 'persistent',
        buildDependencies: [__filename],
        storage: {
          type: 'filesystem',
          directory: path.resolve(__dirname, '../build/rspack')
        }
      }
    },
    module: {
      rules: [
        {
          resourceQuery: /raw/,
          type: 'asset/source'
        },
        // just keep the woff2 fonts from fontawesome
        {
          test: /fontawesome-free.*\.(svg|eot|ttf|woff)$/,
          exclude: /fontawesome-free.*\.woff2$/
        },
        {
          test: /\.(jpe?g|png|gif|ico|eot|ttf|map|woff2?)(\?v=\d+\.\d+\.\d+)?$/i,
          type: 'asset/resource'
        },
        {
          resourceQuery: /text/,
          type: 'asset/resource',
          generator: {
            filename: '[name][ext]'
          }
        }
      ]
    },
    optimization: {
      moduleIds: 'deterministic',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          jlab_core: {
            test: /[\\/]node_modules[\\/]@(jupyterlab|lumino(?!\/datagrid))[\\/]/,
            name: 'jlab_core'
          }
        }
      }
    },
    plugins: [
      new ModuleFederationPlugin({
        library: {
          type: 'var',
          name: ['_JUPYTERLAB', 'CORE_LIBRARY_FEDERATION']
        },
        name: 'CORE_FEDERATION',
        shared
      }),
      ...allHtmlPlugins
    ]
  })
].concat(...allAssetConfig);
