export function selectText(node: HTMLElement): void {
  if (node instanceof HTMLInputElement && node.type === 'text') {
    node.select();
  } else if (node instanceof Node && window.getSelection) {
    const range = document.createRange();
    range.selectNode(node);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
