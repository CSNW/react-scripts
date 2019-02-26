const { join, resolve } = require('path');
const { existsSync } = require('fs');
const uuid = require('uuid/v4');

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

function withCRA(next_config = {}) {
  const {
    src = 'src',
    public = 'public',
    pages,
    build = 'build',
    dist,
  } = next_config.cra || {};

  const appSrc = resolve(src);
  const appPublic = resolve(public);
  const appBuild = resolve(build);
  const appIndexJs = join(appSrc, pages ? pages.index : 'index.js');
  const appHtml = join(appPublic, 'index.html');

  return Object.assign({}, next_config, {
    cra: { appSrc, appPublic, appBuild, appIndexJs, appHtml },

    webpack(config) {
      if (pages) {
        for (let [target, entry] of Object.entries(pages)) {
          target = join(appPublic, `${target}.html`);
          entry = join(appSrc, entry);
        }
      }

      if (typeof next_config.webpack === 'function') {
        return next_config.webpack(config);
      }

      return config;
    },
  });
}

module.exports = { applyPaths, applyWebpackConfig };
