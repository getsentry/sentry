export function selectText(node) {
  if (node.type && node.type === 'text') {
    node.select();
  } else if (document.selection) {
    const range = document.body.createTextRange();
    range.moveToElementText(node);
    range.select();
  } else if (window.getSelection) {
    const range = document.createRange();
    range.selectNode(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
