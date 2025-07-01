import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'
import styles from 'rollup-plugin-styles'

const isDemoEnvironment = process.env.demo || false

const bundleConf = () => ({
  input: 'lib/multi-select.js',
  output: {
    file: 'dist/js/handsontable-multi-select.js',
    format: 'cjs',
  },
  plugins: [ resolve(), babel({ babelHelpers: 'bundled' }) ],
  external: [ 'handsontable', 'debounce-fn' ],
})

const demoConf = () => ({
  input: 'web/main.js',
  output: {
    file: 'web/bundle.js',
    format: 'iife',
    globals: {
      handsontable: 'Handsontable',
    },
  },
  plugins: [ resolve(), serve('web'), styles(), livereload() ],
  external: [ 'handsontable' ],
})

const getConf = isDemoEnvironment
  ? demoConf
  : bundleConf

export default getConf()
