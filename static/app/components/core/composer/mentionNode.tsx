import {createContext, useContext} from 'react';
import {
  $create,
  $getDocument,
  $getNearestNodeFromDOMNode,
  $getState,
  $setState,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  createState,
  DecoratorNode,
  stringValue,
  type LexicalEditor,
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

/**
 * Places the caret on the nearer side of a clicked mention. Mentions are not
 * editable, so the browser otherwise drops the selection and the next
 * keystroke lands at the start of the editor.
 */
export function registerMentionClick(editor: LexicalEditor) {
  return editor.registerCommand(
    CLICK_COMMAND,
    event => {
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-mention]')
          : null;
      const node = element ? $getNearestNodeFromDOMNode(element) : null;
      if (!element || !$isComposerMentionNode(node)) {
        return false;
      }

      // A wrapped mention has one box per line, so compare against the clicked one.
      const box =
        Array.from(element.getClientRects()).find(
          rect => event.clientY >= rect.top && event.clientY <= rect.bottom
        ) ?? element.getBoundingClientRect();
      if (event.clientX < box.left + box.width / 2) {
        node.selectPrevious();
      } else {
        node.selectNext(0, 0);
      }
      return true;
    },
    COMMAND_PRIORITY_LOW
  );
}
