import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, type Responsive} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

export const StyledPanel = styled(Panel)`
  margin-bottom: 0px;
  overflow: hidden;
`;

export const WrappingText = styled('div')`
  width: 100%;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const SpanTableCell = styled(SimpleTable.FullWidthCell)`
  background-color: ${p => p.theme.colors.gray100};
  padding: ${p => p.theme.space.md};
`;

export const BreakdownCell = styled(SimpleTable.RowCell, {
  shouldForwardProp: prop => prop !== 'highlightedSliceName',
})<{highlightedSliceName: string}>`
  ${p =>
    p.highlightedSliceName
      ? css`--highlightedSlice-${p.highlightedSliceName}-opacity: 1.0;
         --highlightedSlice-${p.highlightedSliceName}-saturate: saturate(1.0) contrast(1.0);
         --highlightedSlice-${p.highlightedSliceName}-transform: translateY(0px);
       `
      : null}
  ${p =>
    p.highlightedSliceName
      ? css`
          --defaultSlice-opacity: 1;
          --defaultSlice-saturate: saturate(0.7) contrast(0.9) brightness(1.2);
          --defaultSlice-transform: translateY(0px);
        `
      : css`
          --defaultSlice-opacity: 1;
          --defaultSlice-saturate: saturate(1) contrast(1);
          --defaultSlice-transform: translateY(0px);
        `}
`;

export function EmptyStateText({
  children,
  size,
  textAlign,
}: {
  children: React.ReactNode;
  size: 'xl' | 'md';
  textAlign?: Responsive<'left' | 'center' | 'right' | 'justify'>;
}) {
  return (
    <Container>
      <Text as="div" size={size} align={textAlign} variant="muted">
        {children}
      </Text>
    </Container>
  );
}

export const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
