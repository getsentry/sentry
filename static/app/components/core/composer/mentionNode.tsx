import {createContext, useContext} from 'react';
import {
  $create,
  $getDocument,
  $getState,
  $setState,
  createState,
  DecoratorNode,
  stringValue,
  type LexicalNode,
} from 'lexical';

import type {Mention} from './model';
import {MentionChip} from './styles';

export type MentionData = Pick<Mention, 'id' | 'sourceId' | 'text'>;

export type MentionRenderer = (mention: MentionData) => React.ReactNode;

/** Resolves the source-provided renderer for a mention, by source id. */
export const MentionRendererContext = createContext<
  ((sourceId: string) => MentionRenderer | undefined) | null
>(null);

const idState = createState('id', {parse: stringValue()});
const sourceIdState = createState('sourceId', {parse: stringValue()});
const textState = createState('text', {parse: stringValue()});

function ComposerMention(mention: MentionData) {
  const getRenderer = useContext(MentionRendererContext);
  const content = getRenderer?.(mention.sourceId)?.(mention) ?? mention.text;
  return <MentionChip>{content}</MentionChip>;
}

/**
 * An atomic inline reference. The caret moves around it and a single deletion
 * removes all of it, while its `text` still counts toward the plain-text value.
 */
export class ComposerMentionNode extends DecoratorNode<React.ReactNode> {
  $config() {
    return this.config('composer-mention', {
      extends: DecoratorNode,
      stateConfigs: [
        {flat: true, stateConfig: idState},
        {flat: true, stateConfig: sourceIdState},
        {flat: true, stateConfig: textState},
      ],
    });
  }

  getMention(): MentionData {
    return {
      id: $getState(this, idState),
      sourceId: $getState(this, sourceIdState),
      text: $getState(this, textState),
    };
  }

  setMention({id, sourceId, text}: MentionData): this {
    return $setState(
      $setState($setState(this, idState, id), sourceIdState, sourceId),
      textState,
      text
    );
  }

  createDOM(): HTMLElement {
    const element = $getDocument().createElement('span');
    element.dataset.mention = '';
    element.setAttribute('contenteditable', 'false');
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return $getState(this, textState);
  }

  isInline(): true {
    return true;
  }

  // Keep arrow keys and deletion on range selections so a mention behaves like
  // one wide character instead of becoming a separately selected block.
  isKeyboardSelectable(): false {
    return false;
  }

  decorate(): React.ReactNode {
    return <ComposerMention {...this.getMention()} />;
  }
}

export function $createComposerMentionNode(mention: MentionData): ComposerMentionNode {
  return $create(ComposerMentionNode).setMention(mention);
}

export function $isComposerMentionNode(
  node: LexicalNode | null | undefined
): node is ComposerMentionNode {
  return node instanceof ComposerMentionNode;
}
