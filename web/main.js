import { MultiSelectEditor, MultiSelectRenderer } from '../lib/multi-select'

const sheet = document.getElementById('sheet')

const headers = [ 'Name', 'Email', 'Country' ]

const exampleData = [
  [ 'Frankie', 'Herrington'  ],
  [ 'Lois', 'Braun' ],
  [ 'Leo', 'Vernon' ],
]

new Handsontable(sheet, {
  data: exampleData,
  rowHeaders: true,
  colHeaders: headers,
  columns: [
    {},
    {},
    {
      editor: MultiSelectEditor,
      renderer: MultiSelectRenderer,
      select: {
        config: {},
        options: [
          { key: 'se', text: 'Sweden' },
          { key: 'us', text: 'United States' },
          { key: 'br', text: 'Brazil' },
        ]
      }
    }
  ]
})
