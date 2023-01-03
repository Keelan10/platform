const Path = require('path');
const ReplaceConfigFile = require('./lib/ReplaceConfigFile');

const outDir = process.env.BUILD_DIR ?? 'build'
const outputDir = Path.resolve(__dirname, '../..', outDir, 'databox/docpage/dist');

module.exports = {
  outputDir,
  lintOnSave: false,
  runtimeCompiler: true,
  pages: {
    index: {
      entry: './src/main.ts',
      template: './index.html',
      filename: 'index.html',
      title: 'Ulixee'
    },
  },
  publicPath: './',
  chainWebpack(config) {
    config.module
      .rule('vue')
      .use('vue-loader')
      .loader('vue-loader')
      .tap(options => {
        options.compilerOptions = options.compilerOptions || {};
        options.compilerOptions.whitespace = 'preserve'
        return options
      });
    if (process.env.NODE_ENV === 'production') {
      config.plugin('ReplaceConfigFile').use(ReplaceConfigFile, [ ['$DATABOX_CONFIG_DATA'] ]);
    }
  }
}
