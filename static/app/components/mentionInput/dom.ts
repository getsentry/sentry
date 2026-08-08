export interface EditorSelection {
  end: number;
  start: number;
}

function isLineBreak(node: Node): node is HTMLBRElement {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR';
}

function isLineContainer(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    ['DIV', 'P'].includes((node as Element).tagName)
  );
}

export function readEditorValue(root: Node): string {
  let value = '';

  const visit = (node: Node, isRootChild = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      value += node.textContent ?? '';
      return;
    }

    if (isLineBreak(node)) {
      value += '\n';
      return;
    }

    if (isRootChild && isLineContainer(node) && value && !value.endsWith('\n')) {
      value += '\n';
    }

    node.childNodes.forEach(child => visit(child));
  };

  const isEmptyPlaceholder =
    root.childNodes.length === 1 && isLineBreak(root.childNodes[0]!);
  if (!isEmptyPlaceholder) {
    root.childNodes.forEach(child => visit(child, true));
  }

  return value;
}

function getTextOffset(root: HTMLElement, node: Node, offset: number): number | null {
  if (node !== root && !root.contains(node)) {
    return null;
  }

  const range = document.createRange();
  range.selectNodeContents(root);

  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }

  const fragmentRoot = document.createElement('div');
  fragmentRoot.append(range.cloneContents());
  return readEditorValue(fragmentRoot).length;
}

export function getEditorSelection(root: HTMLElement): EditorSelection | null {
  const selection = window.getSelection();
  if (!selection?.anchorNode || !selection.focusNode) {
    return null;
  }

  const anchor = getTextOffset(root, selection.anchorNode, selection.anchorOffset);
  const focus = getTextOffset(root, selection.focusNode, selection.focusOffset);
  if (anchor === null || focus === null) {
    return null;
  }

  return {start: Math.min(anchor, focus), end: Math.max(anchor, focus)};
}

interface DOMPoint {
  node: Node;
  offset: number;
}

export function getDOMPoint(root: HTMLElement, targetOffset: number): DOMPoint {
  let consumed = 0;
  let point: DOMPoint | null = null;

  const visit = (node: Node, isRootChild = false) => {
    if (point) {
      return;
    }

    if (isRootChild && isLineContainer(node) && consumed > 0) {
      const parent = node.parentNode;
      if (!parent) {
        return;
      }
      const index = Array.from(parent.childNodes).indexOf(node as ChildNode);
      if (targetOffset <= consumed + 1) {
        point = {node: parent, offset: index};
        return;
      }
      consumed += 1;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (length > 0 && targetOffset <= consumed + length) {
        point = {node, offset: targetOffset - consumed};
      }
      consumed += length;
      return;
    }

    if (isLineBreak(node)) {
      const parent = node.parentNode;
      if (!parent) {
        return;
      }
      const index = Array.from(parent.childNodes).indexOf(node);
      if (targetOffset <= consumed + 1) {
        point = {
          node: parent,
          offset: targetOffset <= consumed ? index : index + 1,
        };
      }
      consumed += 1;
      return;
    }

    node.childNodes.forEach(child => visit(child));
  };

  root.childNodes.forEach(child => visit(child, true));
  return point ?? {node: root, offset: root.childNodes.length};
}

export function setEditorSelection(root: HTMLElement, selection: EditorSelection) {
  const domSelection = window.getSelection();
  if (!domSelection) {
    return;
  }

  const start = getDOMPoint(root, selection.start);
  const end = getDOMPoint(root, selection.end);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  domSelection.removeAllRanges();
  domSelection.addRange(range);
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {granularity: 'grapheme'});

export function getDeletionSelection(
  value: string,
  selection: EditorSelection,
  direction: 'backward' | 'forward'
): EditorSelection {
  let {start, end} = selection;

  if (start === end) {
    if (direction === 'backward' && start > 0) {
      let previous = 0;
      for (const segment of GRAPHEME_SEGMENTER.segment(value.slice(0, start))) {
        previous = segment.index;
      }
      start = previous;
    } else if (direction === 'forward' && end < value.length) {
      const segment = GRAPHEME_SEGMENTER.segment(value.slice(end))
        [Symbol.iterator]()
        .next().value;
      end += segment?.segment.length ?? 1;
    }
  }

  return {start, end};
}
