import {memo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export const CompositionRenderBlocker = memo(
  ({children}: {children: React.ReactNode; isComposing: boolean}) => children,
  (previousProps, nextProps) =>
    nextProps.isComposing || previousProps.children === nextProps.children
);

export const MentionEditor = styled('div')<{minHeight?: number}>`
  ${p => {
    const boxShadow = `0 1px 0 0 ${p.theme.tokens.interactive.chonky.debossed.neutral.chonk} inset`;
    return {
      display: 'block',
      width: '100%',
      color: p.theme.tokens.content.primary,
      backgroundColor: p.theme.tokens.interactive.chonky.debossed.neutral.background,
      boxShadow,
      border: `1px solid ${p.theme.tokens.border.primary}`,
      borderRadius: p.theme.form.md.borderRadius,
      fontFamily: p.theme.font.family.sans,
      fontSize: p.theme.form.md.fontSize,
      fontWeight: p.theme.font.weight.sans.regular,
      minHeight: p.minHeight,
      paddingBottom: p.theme.form.md.paddingBottom,
      paddingLeft: p.theme.form.md.paddingLeft,
      paddingRight: p.theme.form.md.paddingRight,
      paddingTop: p.theme.form.md.paddingTop,
      transition: `border ${p.theme.motion.smooth.fast}, box-shadow ${p.theme.motion.smooth.fast}`,
      '&:focus, &:focus-visible': p.theme.focusRing(boxShadow),
    };
  }};
  height: auto;
  overflow: auto;
  cursor: text;
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  &:empty::before {
    color: ${p => p.theme.tokens.content.secondary};
    content: attr(data-placeholder);
    pointer-events: none;
    white-space: pre-wrap;
  }
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

export function SuggestionStatus({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" justify="center" minHeight="64px" padding="md">
      <Text as="p" size="sm" variant="muted" align="center">
        {children}
      </Text>
    </Flex>
  );
}
