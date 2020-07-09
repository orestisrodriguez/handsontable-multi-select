import { pluck, times } from 'ramda'
import { MultiSelectEditor, MultiSelectRenderer } from '../lib/multi-select'
import data from './users'
import options from './options'

const sheet = document.getElementById('sheet')

const headers = [ 'First name', 'Last name', 'Email', 'Job title', 'Country', 'Single Number', 'Multi Numbers' ]

const numberOptions = times((i) => ({ key: i, value: i }), 50)

const hot = new Handsontable(sheet, {
  data,
  licenseKey: 'non-commercial-and-evaluation',
  rowHeaders: true,
  colHeaders: headers,
  width: '60%',
  stretchH: 'all',
  columns: [
    {},
    {},
    {},
    {},
    {
      type: 'text',
      editor: MultiSelectEditor,
      renderer: MultiSelectRenderer,
      select: {
        config: {
          valueKey: 'key',
          labelKey: 'text',
          separator: ';',
        },
        options (source, process) {
          return new Promise((resolve) => {
            setTimeout(resolve, 500, options)
          })
        },
      }
    }, {
      type: 'numeric',
      editor: MultiSelectEditor,
      renderer: MultiSelectRenderer,
      select: {
        config: {
          valueKey: 'key',
          labelKey: 'value',
        },
        options (source, process) {
          return new Promise((resolve) => {
            setTimeout(resolve, 500, numberOptions)
          })
        },
      }
    }
  ]
})
