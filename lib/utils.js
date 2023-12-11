const isEmptyString = (s) => !s?.trim()

const normalizeOptions = (keyLabel, valueLabel) => (options) => (
  options.map((item) => ({
    key: item[keyLabel].toString(),
    value: item[valueLabel].toString(),
  }))
)

function findNode (libraryNode, key) {
  return libraryNode.querySelector(`[key="${key}"]`)
}

function scrollToSelection (targetChild) {
  const itemNode = targetChild
  const { parentNode } = targetChild

  const { scrollTop: pScroll, offsetHeight: pHeight } = parentNode
  const { offsetTop: iTop, offsetHeight: iHeight } = itemNode
  const iHeightHalf = iHeight / 2

  if (iTop + iHeightHalf > pScroll + pHeight) {
    parentNode.scrollTop = iTop
  } else if (iTop < pScroll) {
    parentNode.scrollTop -= pHeight - iHeightHalf
  }
}

async function executePotentialFn (fnOrValue, ...args) {
  if (typeof fnOrValue === 'function') {
    return fnOrValue(...args)
  }

  return fnOrValue
}

function getVisualRowAndColForCellProperties (cellProperties, hot) {
  const { visualRow: row, visualCol: columnProp } = cellProperties

  // NOTE: When using "columnSorting" in handsontable,
  // "col" may return prop (column key/name) instead of a numeric index.
  // Manually fetching the column index makes the plugin
  // support the "columnSorting" feature.
  const col = hot.propToCol(columnProp)

  return { row, col }
}

export {
  isEmptyString,
  normalizeOptions,
  findNode,
  scrollToSelection,
  executePotentialFn,
  getVisualRowAndColForCellProperties,
}
