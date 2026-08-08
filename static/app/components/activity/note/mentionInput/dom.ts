import type {MentionValue} from './model';

export const ZERO_WIDTH_SPACE = '\u200B';

export interface EditorSelection {
  end: number;
  start: number;
}

interface EditorSnapshot {
  mentions: readonly MentionValue[];
  value: string;
}

function isMentionElement(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).dataset.mentionIndex !== undefined
  );
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

function plainText(text: string): string {
  return text.replaceAll(ZERO_WIDTH_SPACE, '');
}

export function readEditorSnapshot(
  root: Node,
  currentMentions: readonly MentionValue[]
): EditorSnapshot {
  let value = '';
  const nextMentions: MentionValue[] = [];

  const visit = (node: Node, isRootChild = false) => {
    if (isMentionElement(node)) {
      const mention = currentMentions[Number(node.dataset.mentionIndex)];
      if (!mention) {
        return;
      }

      const start = value.length;
      value += mention.text;
      nextMentions.push({...mention, start, end: value.length});
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      value += plainText(node.textContent ?? '');
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

  return {value, mentions: nextMentions};
}

function getPlainOffset(
  root: HTMLElement,
  node: Node,
  offset: number,
  mentions: readonly MentionValue[]
): number | null {
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
  return readEditorSnapshot(fragmentRoot, mentions).value.length;
}

export function getEditorSelection(
  root: HTMLElement,
  mentions: readonly MentionValue[]
): EditorSelection | null {
  const selection = window.getSelection();
  if (!selection?.anchorNode || !selection.focusNode) {
    return null;
  }

  const anchor = getPlainOffset(
    root,
    selection.anchorNode,
    selection.anchorOffset,
    mentions
  );
  const focus = getPlainOffset(
    root,
    selection.focusNode,
    selection.focusOffset,
    mentions
  );
  if (anchor === null || focus === null) {
    return null;
  }

  return {start: Math.min(anchor, focus), end: Math.max(anchor, focus)};
}

interface DOMPoint {
  node: Node;
  offset: number;
}

function rawTextOffset(text: string, targetOffset: number): number {
  let plainOffset = 0;
  for (let rawOffset = 0; rawOffset < text.length; rawOffset += 1) {
    if (text[rawOffset] !== ZERO_WIDTH_SPACE) {
      if (plainOffset === targetOffset) {
        return rawOffset;
      }
      plainOffset += 1;
    }
  }
  return text.length;
}

export function getDOMPoint(
  root: HTMLElement,
  targetOffset: number,
  mentions: readonly MentionValue[]
): DOMPoint {
  let consumed = 0;
  let point: DOMPoint | null = null;

  const visit = (node: Node) => {
    if (point) {
      return;
    }

    if (isMentionElement(node)) {
      const mention = mentions[Number(node.dataset.mentionIndex)];
      const length = mention?.text.length ?? 0;
      const parent = node.parentNode;
      if (!parent) {
        return;
      }
      const index = Array.from(parent.childNodes).indexOf(node);

      if (targetOffset <= consumed) {
        point = {node: parent, offset: index};
      } else if (targetOffset <= consumed + length) {
        point = {node: parent, offset: index + 1};
      }
      consumed += length;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const length = plainText(text).length;
      if (length > 0 && targetOffset <= consumed + length) {
        point = {node, offset: rawTextOffset(text, targetOffset - consumed)};
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

    node.childNodes.forEach(visit);
  };

  root.childNodes.forEach(visit);
  return point ?? {node: root, offset: root.childNodes.length};
}

export function setEditorSelection(
  root: HTMLElement,
  selection: EditorSelection,
  mentions: readonly MentionValue[]
) {
  const domSelection = window.getSelection();
  if (!domSelection) {
    return;
  }

  const start = getDOMPoint(root, selection.start, mentions);
  const end = getDOMPoint(root, selection.end, mentions);
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
  mentions: readonly MentionValue[],
  direction: 'backward' | 'forward'
): EditorSelection {
  let {start, end} = selection;

  if (start === end) {
    const adjacentMention = mentions.find(mention =>
      direction === 'backward' ? mention.end === start : mention.start === start
    );
    if (adjacentMention) {
      return {start: adjacentMention.start, end: adjacentMention.end};
    }

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

  for (const mention of mentions) {
    if (mention.start < end && mention.end > start) {
      start = Math.min(start, mention.start);
      end = Math.max(end, mention.end);
    }
  }

  return {start, end};
}
