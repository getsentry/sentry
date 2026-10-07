import {useRef} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import {useContainerColumnCount} from 'sentry/utils/useContainerColumnCount';

export const keyValueGridStyles = (p: {theme: Theme}) => css`
  display: grid;
  grid-template-columns: fit-content(50%) 1fr;
  column-gap: ${p.theme.space.lg};
  align-content: start;
  font-size: ${p.theme.font.size.sm};
`;

interface KeyValueColumnsProps {
  children: (columnCount: number) => React.ReactNode[][];
  /**
   * Fixed column count. Defaults to one measured from the container's width.
   */
  columnCount?: number;
  columnTestId?: string;
  'data-test-id'?: string;
}

export function KeyValueColumns({
  children,
  columnCount,
  columnTestId = 'key-value-column',
  'data-test-id': dataTestId,
}: KeyValueColumnsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measuredColumnCount = useContainerColumnCount(containerRef);
  const resolvedColumnCount = columnCount ?? measuredColumnCount;

  return (
    <Grid
      align="start"
      columns={`repeat(${resolvedColumnCount}, minmax(0, 1fr))`}
      whiteSpace="normal"
      ref={containerRef}
      data-test-id={dataTestId}
    >
      {children(resolvedColumnCount).map((rows, index) => (
        <Column key={index} data-test-id={columnTestId}>
          {rows}
        </Column>
      ))}
    </Grid>
  );
}

const Column = styled('div')`
  ${keyValueGridStyles};

  &:first-child {
    margin-left: -${p => p.theme.space.sm};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-left: ${p => p.theme.space.xl};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-right: ${p => p.theme.space.xl};
  }
`;
