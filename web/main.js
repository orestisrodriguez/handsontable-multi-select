import { MultiSelectEditor, MultiSelectRenderer } from '../lib/multi-select'
import data from './users'
import options from './options'

const sheet = document.getElementById('sheet')

const headers = [ 'First name', 'Last name', 'Email', 'Job title', 'Country' ]

new Handsontable(sheet, {
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
      editor: MultiSelectEditor,
      renderer: MultiSelectRenderer,
      select: {
        config: {},
        options
      }
    }
  ]
})
