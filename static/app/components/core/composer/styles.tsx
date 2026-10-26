import styled from '@emotion/styled';

import {ListBox} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import type {FormSize} from '@sentry/scraps/theme';

// Emotion retains Input's ref type after changing the rendered element.
const InputTextArea = Input.withComponent('textarea') as React.ComponentType<
  React.ComponentPropsWithRef<'textarea'> & {size?: FormSize}
>;

/**
 * The textarea owns text, selection, undo, and input methods. Its own text is
 * transparent; `ComposerMirror` draws the visible text over it.
 */
export const ComposerTextArea = styled(InputTextArea)`
  height: auto;
  overflow-y: auto;
  resize: none;
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  caret-color: ${p => p.theme.tokens.content.primary};

  &,
  &[disabled],
  &[aria-disabled='true'] {
    color: transparent;
    /* Safari paints disabled textarea text with the fill color. */
    -webkit-text-fill-color: transparent;
  }

  /* iOS Safari zooms the page when focusing an editable element with text
     smaller than 16px, which can push adjacent controls such as a send button
     off-screen. */
  @media (hover: none) and (pointer: coarse) {
    font-size: ${p => p.theme.font.size.lg};
  }
`;

/**
 * Lays out the same text as the textarea, at the same position, so every
 * glyph sits exactly over its transparent twin. Font, padding, and border
 * widths are copied from the textarea at runtime.
 */
export const ComposerMirror = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  pointer-events: none;
  border-style: solid;
  border-color: transparent;
  color: ${p => p.theme.tokens.content.primary};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  &[data-disabled] {
    color: ${p => p.theme.tokens.content.disabled};
    opacity: 60%;
  }
`;

export const MentionChip = styled('span')`
  position: relative;
  color: ${p => p.theme.tokens.content.accent};
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
  border-radius: ${p => p.theme.radius.xs};
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;

  &[data-custom]:not([data-wrapped]) > [data-mention-text] {
    color: transparent;
  }

  &[data-wrapped] > [data-mention-content] {
    display: none;
  }
`;

export const MentionContent = styled('span')`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
`;

export const CaretAnchor = styled('span')`
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  visibility: hidden;
  pointer-events: none;
`;

export const SuggestionListBox = styled(ListBox)`
  min-width: 220px;
  max-width: 360px;
  max-height: 200px;
`;

export function SuggestionStatus({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" justify="center" minHeight="64px" padding="md">
      <Text as="p" size="sm" variant="muted" align="center">
        {children}
      </Text>
    </Flex>
  );
}
