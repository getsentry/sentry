import {act} from 'sentry-test/reactTestingLibrary';

interface CaretPoint {
  node: Node;
  offset: number;
}

// jsdom does not implement isContentEditable.
function isAtomic(node: Node): boolean {
  return node instanceof HTMLElement && node.getAttribute('contenteditable') === 'false';
}

function findCaretPoint(root: HTMLElement, offset: number): CaretPoint | null {
  let remaining = offset;

  const visit = (parent: Node): CaretPoint | null => {
    for (const [index, node] of Array.from(parent.childNodes).entries()) {
      if (node instanceof Text) {
        if (remaining <= node.length) {
          return {node, offset: remaining};
        }
        remaining -= node.length;
      } else if (isAtomic(node)) {
        // An atomic inline element such as a mention counts as its text.
        remaining -= node.textContent?.length ?? 0;
        if (remaining <= 0) {
          return {node: parent, offset: index + 1};
        }
      } else if (node instanceof HTMLBRElement) {
        if (!node.hasAttribute('data-lexical-managed-linebreak')) {
          remaining -= 1;
          if (remaining === 0) {
            return {node: parent, offset: index + 1};
          }
        }
      } else {
        const point = visit(node);
        if (point) {
          return point;
        }
      }
    }
    return null;
  };

  return visit(root);
}

function findEndPoint(root: Node): CaretPoint {
  const last = root.lastChild;
  if (last instanceof Text) {
    return {node: last, offset: last.length};
  }
  if (
    last instanceof HTMLElement &&
    !isAtomic(last) &&
    !(last instanceof HTMLBRElement) &&
    last.childNodes.length > 0
  ) {
    return findEndPoint(last);
  }
  if (
    last instanceof HTMLBRElement &&
    last.hasAttribute('data-lexical-managed-linebreak')
  ) {
    return {node: root, offset: root.childNodes.length - 1};
  }
  return {node: root, offset: root.childNodes.length};
}

/**
 * Moves the caret to a plain-text offset in a contenteditable, or to its end
 * when `offset` is omitted. user-event cannot move the caret in contenteditable
 * elements with keys such as `{End}`, and editors read the DOM selection.
 */
export function placeCaret(element: HTMLElement, offset?: number) {
  const point =
    offset === undefined
      ? findEndPoint(element)
      : (findCaretPoint(element, offset) ?? findEndPoint(element));

  act(() => {
    element.ownerDocument
      .getSelection()
      ?.setBaseAndExtent(point.node, point.offset, point.node, point.offset);
    element.ownerDocument.dispatchEvent(new Event('selectionchange'));
  });
}
