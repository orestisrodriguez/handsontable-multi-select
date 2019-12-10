import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'

export default {
  input: `${__dirname}/main.js`,
  output: {
    file: `${__dirname}/bundle.js`,
    format: 'iife',
    globals: {
      'handsontable/dist/handsontable.full': 'Handsontable',
      'ramda': 'R',
      'choices.js': 'Choices'
    },
  },
  plugins: [
    serve('web'),
    livereload()
  ]
}
