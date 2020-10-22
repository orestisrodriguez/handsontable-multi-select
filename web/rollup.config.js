import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'
import styles from 'rollup-plugin-styles'

export default {
  input: `${__dirname}/main.js`,
  output: {
    file: `${__dirname}/bundle.js`,
    format: 'iife',
    globals: {
      handsontable: 'Handsontable',
    },
  },
  plugins: [
    serve('web'),
    styles(),
    livereload(),
  ],
}
