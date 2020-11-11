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

export {
  isEmptyString,
  normalizeOptions,
  findNode,
  scrollToSelection,
}
