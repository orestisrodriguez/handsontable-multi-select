# handsontable-multi-select

Handsontable editor and renderer for a multi select input using chosen.js, no jQuery. WARNING: all 0.x.x versions are refering to old versions of handsontable. If you have the newest version, please refer to latest 1.x.x.

## Installation

```bash
yarn add handsontable-multi-select
```

## Usage

Just import the editor class and renderer function from handsontable-multi-select package, and you're good to go.
We also provide a css stylesheet that you can import like below.

```javascript
import { MultiSelectEditor, MultiSelectRenderer } from 'handsontable-multi-select'
import 'handsontable-multi-select/dist/css/handsontable-multi-select.css'

new Handsontable(el, {
  ...,
  columns: [
    {
      editor: MultiSelectEditor,
      renderer: MultiSelectRenderer,
      select: {
        options: [
          { key: 'SE', text: 'Sweden' },
          ...
        ]
      }
    }
  ]
})
```

## To do

- testing for editor.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
