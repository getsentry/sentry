export function selectText(node) {
  if (document.selection) {
    let range = document.body.createTextRange();
    range.moveToElementText(node);
    range.select();
  } else if (window.getSelection) {
    let range = document.createRange();
    range.selectNode(node);
    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
