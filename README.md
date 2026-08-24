<h1 align="center">specta 🌟</h1>

[![Github Actions Status](https://github.com/trungleduc/specta/workflows/Build/badge.svg)](https://github.com/trungleduc/specta/actions/workflows/build.yml)
[![Documentation Status](https://readthedocs.org/projects/specta/badge/?version=latest)](https://specta.readthedocs.io/en/latest/?badge=latest)
[![Try on lite](https://jupyterlite.rtfd.io/en/latest/_static/badge.svg)](https://notebook-link.github.io/specta/)

<h2 align="center"> A JupyterLite app to present your Jupyter documents in different ways</h2>

Specta is a custom JupyterLite app for rendering notebooks and Jupyter‑supported files in multiple modes: dashboards, blog‑style articles, fullscreen viewers, and more. It is built on top of [JupyterLite](https://github.com/jupyterlite/jupyterlite), which allows you to share your documents through alternative interfaces to the IDE-like JupyterLab.

## Features

### Multi-mode Notebook Rendering

Render notebooks in:

- **Dashboard mode** – structured panels for interactive widgets and outputs.
- **Article mode** – a minimal, blog-like reading experience.
- **Slides mode** – a fullscreen presentation mode.

### Clean Viewer for all Jupyter-supported file types

View any Jupyter-supported file using Specta's clean viewer with all Jupyter UI elements removed.

### Preview from JupyterLab

A `specta` preview can be launched directly from JupyterLab, letting users verify how their documents will look when published.

### Static Rendering (no kernel required)

Execute a notebook once while authoring and store the result — outputs and `ipywidgets` state — inside the notebook itself, so readers see the rendered document immediately without a kernel ever starting. Enabled per notebook, so the notebooks that need a live kernel keep one. See [Static rendering](#static-rendering).

## Try it online!

You can try it online by clicking on this badge:

[![Try on lite](https://jupyterlite.rtfd.io/en/latest/_static/badge.svg)](https://trungleduc.github.io/specta/specta/)

## Installation and Usage

### Installation

You can install `specta` using `pip` or `conda`

```bash
# Install using pip
pip install specta

# Install using conda
conda install -c conda-forge specta
```

### Building and serving your app

Once installed, you can build your JupyterLite app, a `specta` app will be included automatically in the output directory of `jupyterlite`:

```
jupyter lite build
```

Then serve the contents of the output directory (by default `./_output`) using any static file server. You can access the `Specta` app at the `/specta/` path.

Every file in your JupyterLite contents is reachable through Specta by appending its path, for example `/specta/index.html?path=blog.ipynb`. Which layout is used, whether the top bar is shown, and the rest of the appearance are controlled by the configuration described in [Specta Configuration](#specta-configuration).

If you want to disable specta loading spinner, you can set the environment variable `SPECTA_NO_LOADING_SCREEN` to `1`before calling jupyterlite build command

### Previewing from JupyterLab

While authoring, you don't have to rebuild the site to see the result. In JupyterLab, right-click the file in the file browser and choose **Open With ▸ Specta**: the document is rendered in a panel with the same layouts and the same top bar as the Specta app, using a real kernel. This preview is also where you manage the render cache described below.

### Static rendering

By default Specta starts a kernel and re-executes the notebook every time a reader opens it. If the interactive features of the notebook are not important, you can save time and bandwidth by using the **static rendering** mode

**Static rendering** removes the kernel from that path. You execute the notebook once while authoring and save a _render cache_: the outputs, plus the state of any `ipywidgets` in the document, are stored inside the notebook itself. When a reader later opens that notebook, Specta rebuilds the rendered document directly from the cache and never starts a kernel.

Static rendering is a per-notebook setting, a notebook is rendered from its cache only when **both** of the following are true:

- static rendering is enabled for that notebook, and
- a render cache is stored in the notebook and can be read.

If either is missing — the setting is off, the cache was never saved, or it was written by an incompatible version of Specta — Specta falls back to normal kernel rendering rather than showing a stale or wrong result.

#### Enabling static rendering and saving a cache

Both are done from the JupyterLab/JupyterLite preview, not from the Specta app:

1. Open the notebook in JupyterLab/JupyterLite and launch the Specta preview.
2. Wait for the notebook to finish executing, so the outputs you want to capture are on screen.
3. Open the settings dialog in the top bar and find the **Static rendering** section.
4. Set the **Static rendering** dropdown to **Enable**. If the notebook has no cache yet, Specta offers to save one immediately; confirm the dialog to capture the outputs currently on screen.

To refresh the cache later — after re-running the notebook against new data, for example — click **Save cache** and confirm the dialog.

The setting and the cache are both written into the notebook's metadata and the file is saved. Rebuild your site with `jupyter lite build` to publish the result.

#### Keeping the cache in sync

Specta records a hash of the notebook's code when it saves the cache, and compares it every time the document is opened. The **Static rendering** section of the settings dialog reports:

- **Current render mode** – whether the document on screen was built from the **Saved cache** or from a **Live kernel**.
- **Last cache** – when the cache was saved, if the notebook has one.
- **No render cache found** – the notebook has never been cached; it will render with a kernel.
- **Render cache is out of sync with the notebook** – the code has changed since the cache was saved. Specta asks whether to use the existing cache anyway or to re-run the notebook with a kernel.

Two other actions are available:

- **Clear cache** (preview only) removes the cache from the notebook, returning it to kernel rendering.
- **Render with kernel** is available in the preview _and_ in the Specta app. It lets a reader looking at a statically rendered document start a kernel on demand, for example to interact with widgets whose behaviour depends on running Python.

In the Specta app the **Static rendering** dropdown and the cache buttons are hidden. Readers can still start a kernel with **Render with kernel**, but only the author can change the setting or the cache.

Static rendering applies to notebooks. Other Jupyter-supported files rendered by Specta's clean viewer do not execute code and so have no cache to save.

## Specta Configuration

### Available layouts

Specta comes with three built-in layouts:

- `article`: The default layout, a minimal blog-like reading experience.
- `dashboard`: Renders the notebook as a dashboard.
- `slides`: A fullscreen presentation mode using [reveal.js](https://revealjs.com/).

### Top-level configuration

Specta can be configured using the typicall JupyterLite configuration file: `jupyter-lite.json`. You can add a `spectaConfig` key to the `jupyter-config-data` section of this file to customize the Specta app.

The following options are available:

- `defaultLayout`: The default layout when opening a file.
- `executionDelay`: Delay (in miliseconds) before executing cells.
- `hideTopbar`: Boolean flag to show or hide the top bar.
- `topBar`: Configuration for the top bar.
- `slidesTheme`: The theme for the slides layout. The list of available themes can be found [here](https://revealjs.com/themes/).
- `loadingName`: The string shown during the loading of specta (default to Loading Specta) only available globally not per file.

```json
      "topBar": {
        "icon": "url to the icon file, it's shown on the left of the top bar",
        "title": "Title on the left of the top bar",
        "themeToggle": "Boolean flag to show/hide the theme selector",
        "textColor": "Color of the text on the top bar",
        "background": "Background color of the top bar"
      },
```

- `uiSwitcherOptions`: List of UI options shown in the settings dropdown, allowing users to switch between different interfaces. Each entry has an `id` (the URL segment of the target app) and a `label` (the display name). Defaults to JupyterLab, Notebook, and Specta as a fallback.

```json
      "uiSwitcherOptions": [
        { "id": "lab", "label": "JupyterLab" },
        { "id": "notebooks", "label": "Notebook" },
        { "id": "specta", "label": "Specta" }
      ]
```

- `perFileConfig`: an object with key is the file path and value is the above configuration, it's used to have different layout/top bar config for each files, for example:

```json
      "perFileConfig": {
        "blog.ipynb": {
          "hideTopbar": false,
          "defaultLayout": "article",
          "topBar": {
            "title": "My blog",
            "themeToggle": false
          }
        },
        "slides.ipynb": {
          "hideTopbar": true,
          "slidesTheme": "sky"
        }
      }
```

### Notebook metadata configuration

In addition to the global configuration, you can also configure the layout and top bar for each notebook by using the notebook metadata. You can use the `Specta App Config` of the `Property Inspector` panel of JupyterLab to edit the notebook metadata.

![Metadata](./docs/images/specta-meta.jpg)

The `Enable static rendering` field of this section controls whether the notebook is rendered from its render cache, as described in [Static rendering](#static-rendering). It defaults to `No`, and the **Static rendering** dropdown of the settings dialog writes the same field, so you can set it from either place. This one is deliberately per notebook only: it cannot be set globally or through `perFileConfig`.

### Notebook cell configuration

By default, when you open a notebook in Specta, all code cells are hidden, and placeholder skeletons are shown instead at the position of the cell. You can configure the visibility of each cell by using the Specta cell metadata toolbar.

![Cell toolbar](./docs/images/specta-config.jpg)

By opening the `Property Inspector` panel of JupyterLab and selecting the `Specta Cell Config` section, you can change the display of each cell as follows:

- `Show cell source`: use this toggle to show or hide the cell source code. Default to `false`
- `Show output placeholder`: use this toggle to show or hide the output skeleton. Default to `true`
- `Output size`: use this dropdown to select the size of the cell output. Default to `Small`

### Slides layout configuration

For the slides layout, you can set the cells as a sub-slide for [vertical slide](https://revealjs.com/vertical-slides/) or [a fragment](https://revealjs.com/fragments/) using the Slide Type field in the `Common Tools` section of the `Property Inspector` panel.

![Slide tool](./docs/images/slide-tool.png)
