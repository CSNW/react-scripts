const { join, resolve, relative } = require('path');
const { existsSync } = require('fs');
const uuid = require('uuid/v4');
const sanitize = require('sanitize-filename');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const mri = require('mri');

function applyPaths(paths) {
  const { dir, outdir } = resolveArgs();

  return Object.assign({}, paths, {
    src: join(dir, 'src'),
    static_files: join(dir, 'static'),
    appBuild: outdir,
    appIndexJs: join(dir, 'src', 'index.js'),
    appHtml: join(dir, 'static', 'index.html'),
    appTypeDeclarations: join(dir, 'src', 'react-app-env.d.ts'),
  });
}

function applyWebpackConfig(webpack_config) {
  const config = loadConfig();
  if (!config) return webpack_config;

  return config.webpack(webpack_config, {
    buildId: uuid(),
    dev: process.env.NODE_ENV !== 'production',
    isServer: false,
    defaultLoaders: {
      babel: undefined, // TODO babel-loader configuration
      hotSelfAccept: undefined,
    },
  });
}

function applyServerConfig(webpack_dev_server_config) {
  const config = loadConfig();
  if (!config || !config.server) return webpack_dev_server_config;

  return config.server(webpack_dev_server_config);
}

function loadConfig() {
  const { dir } = resolveArgs();
  const config_path = join(dir, 'csnw.config.js');
  if (!existsSync(config_path)) return;

  return withCRA({ ...require(config_path), dir });
}

function resolveArgs() {
  const args = mri(process.argv.slice(2), {
    alias: {
      o: 'outdir'
    }
  });
  const dir = resolve(args._[0] || '.');
  const outdir = args.outdir ? resolve(args.outdir) : join(dir, 'build');

  return { dir, outdir };
}

function withCRA(next_config = {}) {
  const { dir = resolve('.') } = next_config;
  const src = join(dir, 'src');
  const static_files = join(dir, 'static');

  return Object.assign({}, next_config, {
    webpack(config, { dev }) {
      if (pages) {
        const entries = {};
        const plugins = [];
        const loader = require.resolve('./html-loader');

        for (let [target, entry] of Object.entries(pages)) {
          const name = sanitize(target);
          target = join(static_files, `${target}.html`);

          entries[name] = join(src, entry);
          plugins.push(
            new HtmlWebpackPlugin({
              template: `${loader}!${target}`,
              filename: relative(static_files, target),
              chunks: [name],
            })
          );
        }

        config.entry = entries;
        config.output.filename = dev
          ? 'static/js/[name].js'
          : 'static/js/[name].[contenthash:8].js';

        const html_index = config.plugins.findIndex(
          plugin => plugin instanceof HtmlWebpackPlugin
        );
        if (html_index < 0) {
          throw new Error(
            'Could not find HtmlWebpackPlugin in webpack plugins'
          );
        }

        config.plugins.splice(html_index, 1, ...plugins);
      }

      if (typeof next_config.webpack === 'function') {
        return next_config.webpack(config);
      }

      return config;
    },
  });
}

module.exports = { applyPaths, applyWebpackConfig, applyServerConfig };
