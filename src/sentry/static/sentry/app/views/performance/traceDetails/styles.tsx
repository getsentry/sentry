import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

export {
  ConnectorBar,
  DividerLine,
  DividerLineGhostContainer,
  DurationPill,
  OperationName,
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
  SpanRowMessage as TransactionRowMessage,
} from 'app/components/events/interfaces/spans/styles';

export const SearchContainer = styled('div')`
  display: flex;
  width: 100%;
`;

export const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

export const TraceDetailHeader = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-gap: ${space(2)};
  margin-top: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) 6fr;
    grid-row-gap: 0;
  }
`;

export const TraceDetailBody = styled('div')`
  margin-top: ${space(2)};
`;

export const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

export const StyledPanel = styled(Panel)`
  overflow: hidden;
`;

export const StyledIconChevron = styled(IconChevron)`
  width: 7px;
  margin-left: ${space(0.25)};
`;
