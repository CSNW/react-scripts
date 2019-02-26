const { join, resolve } = require('path');
const { existsSync } = require('fs');
const uuid = require('uuid/v4');
const sanitize = require('sanitize-filename');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function applyPaths(paths) {
  const config_path = resolve('csnw.config.js');
  if (!existsSync(config_path)) return paths;

  const config = withCRA(require(config_path));
  return Object.assign({}, paths, config.cra);
}

function applyWebpackConfig(webpack_config) {
  const config_path = resolve('csnw.config.js');
  if (!existsSync(config_path)) return webpack_config;

  const config = withCRA(require(config_path));
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

const MINIFY_HTML = {
  minify: {
    removeComments: true,
    collapseWhitespace: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeStyleLinkTypeAttributes: true,
    keepClosingSlash: true,
    minifyJS: true,
    minifyCSS: true,
    minifyURLs: true,
  },
};

function withCRA(next_config = {}) {
  const { src = 'src', public = 'public', pages, build = 'build', dist } =
    next_config.cra || {};

  const appSrc = resolve(src);
  const appPublic = resolve(public);
  const appBuild = resolve(build);
  const appIndexJs = join(appSrc, pages ? pages.index : 'index.js');
  const appHtml = join(appPublic, 'index.html');

  return Object.assign({}, next_config, {
    cra: { appSrc, appPublic, appBuild, appIndexJs, appHtml },

    webpack(config, { dev }) {
      if (pages) {
        const entries = {};
        const plugins = [];
        for (let [target, entry] of Object.entries(pages)) {
          const name = sanitize(target);
          target = join(appPublic, `${target}.html`);

          entries[name] = join(appSrc, entry);
          plugins.push(
            new HtmlWebpackPlugin(
              Object.assign(
                {
                  inject: true,
                  template: target,
                  chunks: [name],
                },
                !dev ? MINIFY_HTML : undefined
              )
            )
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

module.exports = { applyPaths, applyWebpackConfig };
