# handsontable-multi-select

Handsontable editor and renderer for a multi select input using chosen.js, no jQuery.

## Installation

```bash
yarn add handsontable-multi-select
```

## Usage

Just import the editor class and renderer function from handsontable-multi-select package, and you're good to go.

Options can be passed as an array or as a callback function as below.

```javascript
import { MultiSelectEditor, MultiSelectRenderer } from 'handsontable-multi-select'

new Handsontable(el, {
  ...,
  columns: [
    {
      editor: MultiSelectEditor,
      renderer: MultiSelectRenderer,
      select: {
        config: {
          separator: ';',
          valueKey: 'value',
          labelKey: 'label'
        },
        options: [
          { value: 'SE', label: 'Sweden' },
          ...
        ]
        --- OR ---
        options (process) {
          return new Promise((resolve) => setTimeout(resolve, 500, [ ... ]))
        }
      }
    }
  ]
})
```

We also provide default styles for the selector in CSS and LESS that are adapted to handsontable.

`handsontable-multi-select/dist/css/handsontable-multi-select.css` or `handsontable-multi-select/lib/multi-select.less`

You can view a demo of the plugin by cloning this repository and `yarn demo`

## To do

- testing for editor

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
