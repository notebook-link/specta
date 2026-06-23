## Contributing

### Development install

- Create a Conda environment

```bash
mamba create -n specta-dev python nodejs jupyterlab "jupyterlite-core>=0.8" "jupyterlite-xeus>=4.5.4"
mamba activate specta-dev
```

- Install `specta` in editable mode

```bash
pip install -e .
```

- Build and serve the demo

```bash
npm run build:demo
cd demo
python -m http.server -d _output
```

- After changing the source, rebuild the app and the extension then update the demo

```bash
npm run build:all:dev
npm run update:demo
```

Calling `update:demo` instead of `build:demo` is faster as it does not rebuild the JupyterLite instance.
