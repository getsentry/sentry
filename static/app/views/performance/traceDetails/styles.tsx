import {useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import EventTagsPill from 'sentry/components/events/eventTags/eventTagsPill';
import {SecondaryHeader} from 'sentry/components/events/interfaces/spans/header';
import Panel from 'sentry/components/panels/panel';
import Pills from 'sentry/components/pills';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTag} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined, generateQueryWithTag} from 'sentry/utils';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceTransaction} from 'sentry/utils/performance/quickTrace/utils';
import {appendTagCondition} from 'sentry/utils/queryString';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export {
  Row,
  SpanDetails as TransactionDetails,
  SpanDetailContainer as TransactionDetailsContainer,
} from 'sentry/components/events/interfaces/spans/spanDetail';

export const TraceSearchContainer = styled('div')`
  display: flex;
  width: 100%;
`;

export const TraceSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

export const TraceViewHeaderContainer = styled(SecondaryHeader)`
  border-top: none;
  border-bottom: 1px solid ${p => p.theme.border};
  position: sticky;
  top: 0;
  z-index: 1;
`;

export const TraceDetailHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(3)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: max-content max-content;
    grid-row-gap: 0;
  }
`;

export const TraceDetailBody = styled('div')`
  height: 100%;
`;

export const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

export const TracePanel = styled(Panel)`
  height: 100%;
  overflow: auto;
`;

export const ProjectBadgeContainer = styled('span')`
  margin-right: ${space(0.75)};
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const StyledPills = styled(Pills)`
  padding-top: ${space(1.5)};
`;

export function Tags({
  location,
  organization,
  enableHiding,
  event,
  tags,
}: {
  event: TraceFullDetailed | TraceError;
  location: Location;
  organization: Organization;
  tags: EventTag[];
  enableHiding?: boolean;
}) {
  const [showingAll, setShowingAll] = useState(enableHiding ? false : true);

  if (!tags || tags.length <= 0) {
    return null;
  }

  const renderText = showingAll ? t('Show less') : t('Show more') + '...';

  return (
    <tr>
      <td className="key">Tags</td>
      <td className="value">
        <StyledPills>
          {tags.slice(0, showingAll ? tags.length : 5).map((tag, index) => {
            let streamPath = '';
            let query = {};

            if (isTraceTransaction(event)) {
              const route = transactionSummaryRouteWithQuery({
                organization,
                transaction: event.transaction,
                projectID: String(event.project_id),
                query: {
                  ...location.query,
                  query: appendTagCondition(location.query.query, tag.key, tag.value),
                },
              });
              streamPath = route.pathname;
              query = route.query;
            } else {
              streamPath = `/organizations/${organization.slug}/issues/`;
              query = generateQueryWithTag(
                {...location.query, referrer: 'event-tags'},
                tag
              );
            }

            return (
              <EventTagsPill
                key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
                tag={tag}
                projectSlug={event.project_slug}
                projectId={event.project_id.toString()}
                organization={organization}
                query={query}
                streamPath={streamPath}
              />
            );
          })}
          {tags.length > 5 && enableHiding && (
            <div style={{position: 'relative', height: '20px'}}>
              <a
                style={{position: 'absolute', bottom: '0px', whiteSpace: 'nowrap'}}
                onClick={() => setShowingAll(prev => !prev)}
              >
                {renderText}
              </a>
            </div>
          )}
        </StyledPills>
      </td>
    </tr>
  );
}
