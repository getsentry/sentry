import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import EventTagsPill from 'app/components/events/eventTags/eventTagsPill';
import {SpanBarTitle} from 'app/components/events/interfaces/spans/spanBar';
import {Panel} from 'app/components/panels';
import Pills from 'app/components/pills';
import SearchBar from 'app/components/searchBar';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {defined} from 'app/utils';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {appendTagCondition} from 'app/utils/queryString';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';

export {
  ConnectorBar,
  DividerLine,
  DividerLineGhostContainer,
  DurationPill,
  OperationName,
  SpanBarRectangle as TransactionBarRectangle,
  SpanBarTitleContainer as TransactionBarTitleContainer,
  SpanRowCell as TransactionRowCell,
  SpanRowCellContainer as TransactionRowCellContainer,
  SpanTreeConnector as TransactionTreeConnector,
  SpanTreeToggler as TransactionTreeToggle,
  SpanTreeTogglerContainer as TransactionTreeToggleContainer,
} from 'app/components/events/interfaces/spans/spanBar';

export {
  Row,
  SpanDetails as TransactionDetails,
  SpanDetailContainer as TransactionDetailsContainer,
} from 'app/components/events/interfaces/spans/spanDetail';

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

export const TransactionBarTitle = styled(SpanBarTitle)`
  display: flex;
  align-items: center;
`;

export const TransactionBarTitleContent = styled('span')`
  margin-left: ${space(0.75)};
`;

const StyledPills = styled(Pills)`
  padding: ${space(1)};
`;

export function Tags({
  location,
  organization,
  transaction,
}: {
  location: Location;
  organization: Organization;
  transaction: TraceFullDetailed;
}) {
  const {tags} = transaction;

  if (!tags || tags.length <= 0) {
    return null;
  }

  const orgSlug = organization.slug;
  const releasesPath = `/organizations/${orgSlug}/releases/`;

  return (
    <tr>
      <td className="key">Tags</td>
      <td className="value">
        <StyledPills>
          {tags.map((tag, index) => {
            const {pathname: streamPath, query} = transactionSummaryRouteWithQuery({
              orgSlug,
              transaction: transaction.transaction,
              projectID: String(transaction.project_id),
              query: {
                ...location.query,
                query: appendTagCondition(location.query.query, tag.key, tag.value),
              },
            });

            return (
              <EventTagsPill
                key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
                tag={tag}
                projectId={transaction.project_slug}
                organization={organization}
                location={location}
                query={query}
                streamPath={streamPath}
                releasesPath={releasesPath}
                hasQueryFeature={false}
              />
            );
          })}
        </StyledPills>
      </td>
    </tr>
  );
}
