import {$createCodeNode, $isCodeNode} from '@lexical/code';
import {$createQuoteNode, $isQuoteNode} from '@lexical/rich-text';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextFormatType,
} from 'lexical';

import {
  parseComposerDocument,
  type ComposerDocument,
  type DocumentBlock,
  type DocumentInline,
  type DocumentMark,
} from './model';
import {$createDocumentAtom, DocumentAtomNode} from './nodes';

export const MARK_FORMATS: Record<DocumentMark, TextFormatType> = {
  bold: 'bold',
  italic: 'italic',
  strike: 'strikethrough',
  code: 'code',
};

function $createInline(node: DocumentInline): LexicalNode[] {
  if (node.type !== 'text') {
    return [$createDocumentAtom(node)];
  }
  return node.text.split('\n').flatMap((line, index) => {
    const text = $createTextNode(line);
    for (const mark of node.marks) {
      text.toggleFormat(MARK_FORMATS[mark]);
    }
    return [...(index > 0 ? [$createLineBreakNode()] : []), ...(line ? [text] : [])];
  });
}

export function $createDocumentNodes(document: ComposerDocument): LexicalNode[] {
  return document.blocks.map(block => {
    switch (block.type) {
      case 'paragraph':
        return $createParagraphNode().append(...block.children.flatMap($createInline));
      case 'quote':
        return $createQuoteNode().append(...block.children.flatMap($createInline));
      case 'codeBlock':
        return $createCodeNode(block.language).append(
          ...$createInline({type: 'text', text: block.text, marks: []})
        );
      case 'attachment':
      case 'rawMarkdown':
        return $createDocumentAtom(block);
    }
  });
}

function readInline(nodes: LexicalNode[]): DocumentInline[] {
  const children: DocumentInline[] = [];
  for (const node of nodes) {
    if (node instanceof DocumentAtomNode) {
      const value = node.getValue();
      if (value.type === 'mention' || value.type === 'reference') {
        children.push(value);
      }
    } else if ($isTextNode(node) || $isLineBreakNode(node)) {
      const allMarks: readonly DocumentMark[] = ['bold', 'italic', 'strike', 'code'];
      const marks = $isTextNode(node)
        ? allMarks.filter(mark => node.hasFormat(MARK_FORMATS[mark]))
        : [];
      const text = $isLineBreakNode(node) ? '\n' : node.getTextContent();
      const previous = children.at(-1);
      if (
        previous?.type === 'text' &&
        JSON.stringify(previous.marks) === JSON.stringify(marks)
      ) {
        children[children.length - 1] = {...previous, text: previous.text + text};
      } else {
        children.push({type: 'text', text, marks});
      }
    } else if ($isElementNode(node)) {
      children.push(...readInline(node.getChildren()));
    }
  }
  return children;
}

export function $readDocument(
  nodes: LexicalNode[] = $getRoot().getChildren()
): ComposerDocument {
  const blocks: DocumentBlock[] = [];
  let inline: LexicalNode[] = [];
  const flush = () => {
    if (inline.length) {
      blocks.push({type: 'paragraph', children: readInline(inline)});
      inline = [];
    }
  };
  for (const node of nodes) {
    if ($isParagraphNode(node) || $isQuoteNode(node)) {
      flush();
      blocks.push({
        type: $isQuoteNode(node) ? 'quote' : 'paragraph',
        children: readInline(node.getChildren()),
      });
    } else if ($isCodeNode(node)) {
      flush();
      blocks.push({
        type: 'codeBlock',
        text: node.getTextContent(),
        language: node.getLanguage() ?? '',
      });
    } else if (node instanceof DocumentAtomNode && !node.isInline()) {
      flush();
      const value = node.getValue();
      if (value.type === 'attachment' || value.type === 'rawMarkdown') {
        blocks.push(value);
      }
    } else {
      inline.push(node);
    }
  }
  flush();
  return parseComposerDocument({version: 1, blocks});
}

export function $writeDocument(document: ComposerDocument): void {
  const root = $getRoot();
  root.clear();
  const nodes = $createDocumentNodes(document);
  root.append(...(nodes.length ? nodes : [$createParagraphNode()]));
}

export function $createBlock(type: 'paragraph' | 'quote' | 'codeBlock'): ElementNode {
  switch (type) {
    case 'paragraph':
      return $createParagraphNode();
    case 'quote':
      return $createQuoteNode();
    case 'codeBlock':
      return $createCodeNode();
  }
}
