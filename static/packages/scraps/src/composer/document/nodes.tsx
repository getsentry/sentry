import type * as React from 'react';
import {createContext, useContext, useMemo} from 'react';
import {
  $create,
  $getDocument,
  $getNodeByKey,
  $getState,
  $setState,
  createState,
  DecoratorNode,
  HISTORY_PUSH_TAG,
  SKIP_DOM_SELECTION_TAG,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import {z} from 'zod';

import {Text} from '@sentry/scraps/text';

import {
  documentAttachmentSchema,
  documentRawMarkdownSchema,
  documentMentionSchema,
  documentReferenceSchema,
  type DocumentAtom,
} from './model';
import type {DocumentComposerProps, DocumentNodeActions} from './types';

const atomSchema = z.union([
  documentMentionSchema,
  documentReferenceSchema,
  documentAttachmentSchema,
  documentRawMarkdownSchema,
]);
const atomState = createState('atom', {
  parse: value => atomSchema.parse(value ?? {type: 'rawMarkdown', source: ''}),
});

export const DocumentRenderersContext = createContext<
  Pick<DocumentComposerProps, 'renderMention' | 'renderReference' | 'renderAttachment'>
>({});

function Atom({
  editor,
  nodeKey,
  value,
}: {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  value: DocumentAtom;
}) {
  const renderers = useContext(DocumentRenderersContext);
  const actions = useMemo<DocumentNodeActions<DocumentAtom>>(
    () => ({
      remove: () =>
        editor.update(
          () => {
            const node = $getNodeByKey(nodeKey);
            if (node instanceof DocumentAtomNode) {
              node.selectPrevious();
              node.remove();
            }
          },
          {discrete: true, tag: HISTORY_PUSH_TAG}
        ),
      replace: next =>
        editor.update(
          () => {
            const node = $getNodeByKey(nodeKey);
            if (node instanceof DocumentAtomNode) {
              node.setValue(atomSchema.parse(next));
            }
          },
          {discrete: true, tag: [HISTORY_PUSH_TAG, SKIP_DOM_SELECTION_TAG]}
        ),
    }),
    [editor, nodeKey]
  );

  switch (value.type) {
    case 'mention':
      return (
        renderers.renderMention?.(value, actions) ?? <Text bold>@{value.label}</Text>
      );
    case 'reference':
      return (
        renderers.renderReference?.(value, actions) ?? <Text bold>{value.label}</Text>
      );
    case 'attachment':
      return renderers.renderAttachment?.(value, actions) ?? <Text>{value.name}</Text>;
    case 'rawMarkdown':
      return (
        <Text as="span" monospace wrap="pre-wrap">
          {value.source}
        </Text>
      );
  }
}

export class DocumentAtomNode extends DecoratorNode<React.ReactNode> {
  $config() {
    return this.config('composer-document-atom', {
      extends: DecoratorNode,
      stateConfigs: [{flat: true, stateConfig: atomState}],
    });
  }

  getValue(): DocumentAtom {
    return $getState(this, atomState);
  }

  setValue(value: DocumentAtom): this {
    return $setState(this, atomState, value);
  }

  isInline(): boolean {
    const {type} = this.getValue();
    return type === 'mention' || type === 'reference';
  }

  isKeyboardSelectable(): boolean {
    return !this.isInline();
  }

  createDOM(): HTMLElement {
    const element = $getDocument().createElement(this.isInline() ? 'span' : 'div');
    element.contentEditable = 'false';
    element.dataset.documentAtom = this.getValue().type;
    return element;
  }

  updateDOM(previous: this): boolean {
    return previous.getValue().type !== this.getValue().type;
  }

  getTextContent(): string {
    const value = this.getValue();
    switch (value.type) {
      case 'mention':
        return `@${value.label}`;
      case 'reference':
        return value.label;
      case 'attachment':
        return value.name;
      case 'rawMarkdown':
        return value.source;
    }
  }

  decorate(editor: LexicalEditor): React.ReactNode {
    return <Atom editor={editor} nodeKey={this.getKey()} value={this.getValue()} />;
  }
}

export function $createDocumentAtom(value: DocumentAtom): DocumentAtomNode {
  return $create(DocumentAtomNode).setValue(value);
}
