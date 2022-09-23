/**
 * Select the text of the provided HTML Element
 */
export function selectText(node: HTMLElement): void {
  if (node instanceof HTMLInputElement && node.type === 'text') {
    node.select();
    return;
  }

  if (node instanceof Node && window.getSelection) {
    const range = document.createRange();
    range.selectNode(node);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
