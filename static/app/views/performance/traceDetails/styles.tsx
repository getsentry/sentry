import styled from '@emotion/styled';
import {Location} from 'history';

import EventTagsPill from 'app/components/events/eventTags/eventTagsPill';
import {SecondaryHeader} from 'app/components/events/interfaces/spans/header';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {Panel} from 'app/components/panels';
import Pills from 'app/components/pills';
import SearchBar from 'app/components/searchBar';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {defined} from 'app/utils';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {appendTagCondition} from 'app/utils/queryString';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';

export {
  Row,
  SpanDetails as TransactionDetails,
  SpanDetailContainer as TransactionDetailsContainer,
} from 'app/components/events/interfaces/spans/spanDetail';

export const SearchContainer = styled('div')`
  display: flex;
  width: 100%;
`;

export const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

export const TraceViewHeaderContainer = styled(SecondaryHeader)`
  position: static;
  top: auto;
  border-top: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

export const TraceDetailHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: minmax(250px, 1fr) minmax(160px, 1fr) 6fr;
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

export const StyledProjectBadge = styled(ProjectBadge)`
  margin-right: ${space(0.75)};
`;

const StyledPills = styled(Pills)`
  padding-top: ${space(1.5)};
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
