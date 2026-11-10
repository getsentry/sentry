import type * as React from 'react';

import type {
  ComposerDocument,
  DocumentAttachment,
  DocumentMark,
  DocumentMention,
  DocumentReference,
} from './model';

export interface DocumentNodeActions<T> {
  remove(): void;
  replace(node: T): void;
}

export interface DocumentComposerHandle {
  focus(): void;
  formatText(mark: DocumentMark): void;
  insertAttachment(attachment: DocumentAttachment): void;
  insertMention(mention: DocumentMention): void;
  insertReference(reference: DocumentReference): void;
  setBlockType(type: 'paragraph' | 'quote' | 'codeBlock'): void;
}

export interface DocumentComposerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | 'children'
  | 'contentEditable'
  | 'defaultValue'
  | 'onChange'
  | 'onBeforeInput'
  | 'onCopy'
  | 'onPaste'
> {
  onChange(document: ComposerDocument): void;
  value: ComposerDocument;
  onFilesDrop?(files: readonly File[]): void;
  ref?: React.Ref<DocumentComposerHandle>;
  renderAttachment?(
    node: DocumentAttachment,
    actions: DocumentNodeActions<DocumentAttachment>
  ): React.ReactNode;
  renderMention?(
    node: DocumentMention,
    actions: DocumentNodeActions<DocumentMention>
  ): React.ReactNode;
  renderReference?(
    node: DocumentReference,
    actions: DocumentNodeActions<DocumentReference>
  ): React.ReactNode;
}
