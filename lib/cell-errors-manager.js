import { getVisualRowAndColForCellProperties } from './utils'

class CellErrorsManager {
  constructor (hotInstance) {
    this.hotInstance = hotInstance
    this.erroredCells = []
  }

  /**
  * Marks the cell as errored, leading to its being marked.
  * NOTE: This function will cause the cell to re-render.
  *
  * @param {String} errorMessage
  * @param {Object} cellProperties
  * */
  throwErrorForCell (errorMessage, cellProperties) {
    const { row, col } = getVisualRowAndColForCellProperties(cellProperties, this.hotInstance)

    const cell = this.hotInstance.getCell(row, col)
    cell.setAttribute('data-error', errorMessage)
    this.rerenderCell(cellProperties)

    this.erroredCells.push(cell)
  }

  dismissErrorForCell (cellProperties) {
    const { row, col } = getVisualRowAndColForCellProperties(cellProperties, this.hotInstance)

    // eslint-disable-next-line no-param-reassign
    const cell = this.hotInstance.getCell(row, col)
    cell.setAttribute('data-error', '')
    this.rerenderCell(cellProperties)

    this.erroredCells = this.erroredCells.filter(
      (t) => cell !== t
    )
  }

  /**
  * Manually re-renders the cell for the specified cellProperties.
  * Usually needed to display an error set after the last render.
  * */
  rerenderCell (cellProperties) {
    const { visualRow: row, visualCol: columnProp } = cellProperties
    const col = this.hotInstance.propToCol(columnProp)

    // NOTE: Setting the last value on the
    // cell triggers re-render.
    const cellData = this.hotInstance.getDataAtCell(row, col)
    this.hotInstance.setDataAtCell(row, col, cellData)
  }

  /**
  * Unmarks all previously affected cells.
  * NOTE: This function will cause all the affected cells to re-render.
  * */
  dismissAllErrors () {
    this.state.erroredCells.forEach(
      ({ cellProperties }) => {
        this.dismissErrorForCell(cellProperties)
      }
    )
  }
}

export default CellErrorsManager
