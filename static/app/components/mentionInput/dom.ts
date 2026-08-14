export interface EditorSelection {
  end: number;
  start: number;
}

interface DOMPoint {
  node: Node;
  offset: number;
}

interface TextRun {
  end: DOMPoint;
  start: DOMPoint;
  text: string;
}

function isLineBreak(node: Node | null): node is HTMLBRElement {
  return node?.nodeName === 'BR';
}

function isLineContainer(node: Node): node is HTMLDivElement | HTMLParagraphElement {
  return node.nodeName === 'DIV' || node.nodeName === 'P';
}

function isPlaceholderLine(node: Node) {
  return (
    isLineContainer(node) && node.childNodes.length === 1 && isLineBreak(node.firstChild)
  );
}

function getTextRuns(root: Node): TextRun[] {
  if (root.childNodes.length === 1 && isLineBreak(root.firstChild)) {
    return [];
  }

  const runs: TextRun[] = [];
  let length = 0;
  let endsWithLineBreak = false;

  const append = (text: string, start: DOMPoint, end: DOMPoint) => {
    if (!text) {
      return;
    }

    runs.push({text, start, end});
    length += text.length;
    endsWithLineBreak = text.endsWith('\n');
  };

  const visit = (node: Node, isRootChild = false) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      append(text, {node, offset: 0}, {node, offset: text.length});
      return;
    }

    if (isLineBreak(node)) {
      const parent = node.parentNode;
      if (parent) {
        const index = Array.from(parent.childNodes).indexOf(node);
        append('\n', {node: parent, offset: index}, {node: parent, offset: index + 1});
      }
      return;
    }

    if (isRootChild && isLineContainer(node)) {
      const parent = node.parentNode;
      if (parent && length > 0 && !endsWithLineBreak) {
        const index = Array.from(parent.childNodes).indexOf(node);
        append('\n', {node: parent, offset: index}, {node, offset: 0});
      }

      if (isPlaceholderLine(node)) {
        return;
      }
    }

    node.childNodes.forEach(child => visit(child));
  };

  root.childNodes.forEach(child => visit(child, true));
  return runs;
}

/** Flattens contenteditable DOM into the plain-text value owned by MentionInput. */
export function readEditorValue(root: Node): string {
  return getTextRuns(root)
    .map(run => run.text)
    .join('');
}

/** Writes the controlled value without making React own contenteditable children. */
export function writeEditorValue(
  root: HTMLElement,
  value: string,
  mentions: ReadonlyArray<{end: number; start: number; text: string}>
) {
  if (
    mentions.length === 0 &&
    !root.querySelector('[data-mention]') &&
    readEditorValue(root) === value
  ) {
    return;
  }

  const fragment = document.createDocumentFragment();
  let offset = 0;

  for (const mention of mentions.toSorted((a, b) => a.start - b.start)) {
    if (mention.start > offset) {
      fragment.append(value.slice(offset, mention.start));
    }

    const element = document.createElement('strong');
    element.dataset.mention = '';
    element.textContent = mention.text;
    fragment.append(element);
    offset = mention.end;
  }

  if (offset < value.length) {
    fragment.append(value.slice(offset));
  }

  root.replaceChildren(fragment);
}

/** Converts a DOM boundary point into an offset in the normalized editor string. */
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

/** Reads the browser selection as an ordered range of flat string offsets. */
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

/** Converts a flat string offset back into a browser Range boundary point. */
export function getDOMPoint(root: HTMLElement, targetOffset: number): DOMPoint {
  let consumed = 0;

  for (const run of getTextRuns(root)) {
    const end = consumed + run.text.length;
    if (targetOffset <= end) {
      if (run.start.node.nodeType === Node.TEXT_NODE) {
        return {
          node: run.start.node,
          offset: Math.max(0, Math.min(run.text.length, targetOffset - consumed)),
        };
      }

      return targetOffset <= consumed ? run.start : run.end;
    }
    consumed = end;
  }

  return {node: root, offset: root.childNodes.length};
}

/** Restores a flat editor selection after React renders the controlled value. */
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
