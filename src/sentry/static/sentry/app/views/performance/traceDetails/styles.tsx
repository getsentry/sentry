import styled from '@emotion/styled';

import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

export {
  ConnectorBar,
  DividerLine,
  DividerLineGhostContainer,
  DurationPill,
  SpanBarRectangle as TransactionBarRectangle,
  SpanBarTitle as TransactionBarTitle,
  SpanBarTitleContainer as TransactionBarTitleContainer,
  SpanRowCell as TransactionRowCell,
  SpanRowCellContainer as TransactionRowCellContainer,
  SpanTreeConnector as TransactionTreeConnector,
  SpanTreeToggler as TransactionTreeToggle,
  SpanTreeTogglerContainer as TransactionTreeToggleContainer,
} from 'app/components/events/interfaces/spans/spanBar';
export {
  SPAN_ROW_HEIGHT as TRANSACTION_ROW_HEIGHT,
  SPAN_ROW_PADDING as TRANSACTION_ROW_PADDING,
  SpanRow as TransactionRow,
} from 'app/components/events/interfaces/spans/styles';

export const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

export const StyledIconChevron = styled(IconChevron)`
  width: 7px;
  margin-left: ${space(0.25)};
`;
