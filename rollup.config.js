let babel = require('rollup-plugin-babel');
let bundleSize = require('rollup-plugin-bundle-size');
let multiEntry = require('rollup-plugin-multi-entry');
let autoExternal = require('rollup-plugin-auto-external');

module.exports = {
  input: 'modules/*.js',
  output: [
    { file: 'build/bundle.js', format: 'cjs' },
    { file: 'build/module.js', format: 'esm' },
  ],
  plugins: [
    babel({
      babelrc: false,
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }),
    bundleSize(),
    multiEntry(),
    autoExternal(),
  ],
};
