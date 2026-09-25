import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  COLUMN_ALIGN_JUSTIFY,
  type ColumnAlign,
} from 'sentry/components/tables/sortableHeaderCell';

interface ColumnLabelProps {
  column: {name: ReactNode; tooltip?: ReactNode};
  align?: ColumnAlign;
  tooltip?: ReactNode;
}

export function ColumnLabel({align, column, tooltip = column.tooltip}: ColumnLabelProps) {
  const label = tooltip ? (
    <LabelTooltip showUnderline title={tooltip}>
      {column.name}
    </LabelTooltip>
  ) : (
    column.name
  );

  return align ? (
    <Flex flex="1" align="center" gap="xs" justify={COLUMN_ALIGN_JUSTIFY[align]}>
      {label}
    </Flex>
  ) : (
    label
  );
}

const LabelTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;
