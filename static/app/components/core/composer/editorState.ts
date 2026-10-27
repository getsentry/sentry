import {
  $createLineBreakNode,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
  type LexicalNode,
  type PointType,
} from 'lexical';

import {
  $createComposerMentionNode,
  $isComposerMentionNode,
  type MentionData,
} from './mentionNode';
import {getRenderableMentions, type ComposerValue, type Mention} from './model';

/** Placeholder for mention characters so triggers never match inside a mention. */
const MENTION_MASK = '\uFFFC';

interface Segment {
  end: number;
  node: LexicalNode;
  start: number;
}

interface Line {
  end: number;
  node: LexicalNode;
  segments: Segment[];
  start: number;
}

interface PointTarget {
  key: string;
  offset: number;
  type: 'element' | 'text';
}

export interface OffsetSelection {
  end: number;
  start: number;
}

function getNodeLength(node: LexicalNode) {
  if ($isTextNode(node)) {
    return node.getTextContentSize();
  }
  if ($isLineBreakNode(node)) {
    return 1;
  }
  return node.getTextContent().length;
}

/**
 * Lays the editor out as the flat string owned by `ComposerValue`. Plain-text
 * Lexical normally keeps one paragraph with line breaks, but pasted or
 * restored states can contain several paragraphs, which join with newlines.
 */
function $getLines(): Line[] {
  const lines: Line[] = [];
  let offset = 0;

  $getRoot()
    .getChildren()
    .forEach((child, index) => {
      if (index > 0) {
        offset += 1;
      }
      const start = offset;
      const segments: Segment[] = [];
      const children = $isElementNode(child) ? child.getChildren() : [child];
      for (const node of children) {
        const length = getNodeLength(node);
        segments.push({node, start: offset, end: offset + length});
        offset += length;
      }
      lines.push({node: child, segments, start, end: offset});
    });

  return lines;
}

export function $readComposerValue(): ComposerValue {
  const mentions: Mention[] = [];
  const text = $getLines()
    .map(line =>
      line.segments
        .map(({node, start, end}) => {
          const content = $isLineBreakNode(node) ? '\n' : node.getTextContent();
          if ($isComposerMentionNode(node)) {
            mentions.push({...node.getMention(), start, end});
          }
          return content;
        })
        .join('')
    )
    .join('\n');

  return {text, mentions};
}

/** The editor text with mention characters masked, for trigger matching. */
export function $readMatchableText(): string {
  const {text, mentions} = $readComposerValue();
  let masked = text;
  for (const mention of mentions) {
    masked =
      masked.slice(0, mention.start) +
      MENTION_MASK.repeat(mention.end - mention.start) +
      masked.slice(mention.end);
  }
  return masked;
}

function $createTextNodes(text: string): LexicalNode[] {
  return text
    .split('\n')
    .flatMap((line, index) => [
      ...(index > 0 ? [$createLineBreakNode()] : []),
      ...(line ? [$createTextNode(line)] : []),
    ]);
}

export function $writeComposerValue(value: ComposerValue) {
  const paragraph = $createParagraphNode();
  let offset = 0;

  for (const mention of getRenderableMentions(value)) {
    paragraph.append(
      ...$createTextNodes(value.text.slice(offset, mention.start)),
      $createComposerMentionNode(mention)
    );
    offset = mention.end;
  }
  paragraph.append(...$createTextNodes(value.text.slice(offset)));

  $getRoot().clear().append(paragraph);
}

function $getPointTarget(offset: number): PointTarget {
  const lines = $getLines();

  for (const line of lines) {
    if (offset > line.end) {
      continue;
    }

    for (const [index, segment] of line.segments.entries()) {
      if ($isTextNode(segment.node) && offset <= segment.end) {
        return {
          key: segment.node.getKey(),
          offset: Math.max(0, offset - segment.start),
          type: 'text',
        };
      }
      if (offset <= segment.start) {
        return {key: line.node.getKey(), offset: index, type: 'element'};
      }
      if (offset < segment.end) {
        // Offsets inside a mention snap to its end; mentions are atomic.
        return {key: line.node.getKey(), offset: index + 1, type: 'element'};
      }
    }

    return {key: line.node.getKey(), offset: line.segments.length, type: 'element'};
  }

  const lastLine = lines.at(-1);
  return lastLine
    ? {key: lastLine.node.getKey(), offset: lastLine.segments.length, type: 'element'}
    : {key: $getRoot().getKey(), offset: 0, type: 'element'};
}

function $getPointOffset(point: PointType): number | null {
  const lines = $getLines();
  const node = point.getNode();

  if (node.is($getRoot())) {
    const line = lines[point.offset];
    return line ? line.start : (lines.at(-1)?.end ?? 0);
  }

  for (const line of lines) {
    if (line.node.is(node)) {
      return line.segments[point.offset]?.start ?? line.end;
    }
    for (const segment of line.segments) {
      if (segment.node.is(node)) {
        return point.type === 'text'
          ? segment.start + point.offset
          : point.offset === 0
            ? segment.start
            : segment.end;
      }
    }
  }

  return null;
}

export function $getSelectionOffsets(): OffsetSelection | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }

  const anchor = $getPointOffset(selection.anchor);
  const focus = $getPointOffset(selection.focus);
  if (anchor === null || focus === null) {
    return null;
  }

  return {start: Math.min(anchor, focus), end: Math.max(anchor, focus)};
}

export function $setSelectionOffsets({start, end}: OffsetSelection) {
  const selection = $createRangeSelection();
  const anchor = $getPointTarget(start);
  const focus = $getPointTarget(end);
  selection.anchor.set(anchor.key, anchor.offset, anchor.type);
  selection.focus.set(focus.key, focus.offset, focus.type);
  $setSelection(selection);
  return selection;
}

/**
 * Replaces a flat text range with text and an optional mention, then places
 * the caret after the inserted content.
 */
export function $replaceRange(
  range: OffsetSelection,
  {mention, text = ''}: {mention?: MentionData; text?: string}
) {
  const selection = $setSelectionOffsets(range);
  selection.removeText();
  const nodes = [
    ...(mention ? [$createComposerMentionNode(mention)] : []),
    ...$createTextNodes(text),
  ];
  if (nodes.length > 0) {
    $getSelection()?.insertNodes(nodes);
  }
}

/** Returns a DOM range covering a flat text range, when it can be resolved. */
export function getDOMRange(editor: LexicalEditor, {start, end}: OffsetSelection) {
  const root = editor.getRootElement();
  if (!root) {
    return null;
  }

  return editor.getEditorState().read(() => {
    const toDOMPoint = (offset: number) => {
      const target = $getPointTarget(offset);
      const element = editor.getElementByKey(target.key);
      if (!element) {
        return null;
      }
      if (target.type === 'text') {
        const textNode = element.firstChild;
        return textNode?.nodeType === Node.TEXT_NODE
          ? {node: textNode, offset: target.offset}
          : null;
      }
      return {node: element, offset: Math.min(target.offset, element.childNodes.length)};
    };

    const startPoint = toDOMPoint(start);
    const endPoint = toDOMPoint(end);
    if (!startPoint || !endPoint) {
      return null;
    }

    const range = root.ownerDocument.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    return range;
  });
}
