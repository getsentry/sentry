import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DiscoverFeature from 'sentry/components/discover/discoverFeature';
import Link from 'sentry/components/links/link';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {useLocation} from 'sentry/utils/useLocation';
import {TraceInfo} from 'sentry/views/performance/traceDetails/types';

interface LimitExceededMessageProps {
  meta: TraceMeta | null;
  organization: Organization;
  traceEventView: EventView;
  traceInfo: TraceInfo;
  handleLimitChange?: (newLimit: number) => void;
}

const MAX_TRACE_ROWS_LIMIT = 2000;
export const DEFAULT_TRACE_ROWS_LIMIT = 100;

function LimitExceededMessage({
  traceInfo,
  traceEventView,
  organization,
  meta,
  handleLimitChange,
}: LimitExceededMessageProps) {
  // Number of events part of the traceView. Includes errors/issues appearing within txn details ui
  // that appears when you click into a txn row.
  const displayedEventsCount = traceInfo.transactions.size + traceInfo.errors.size;

  const traceMetaEventsCount =
    (meta && meta.transactions + meta.errors) ?? displayedEventsCount;
  const location = useLocation();

  if (traceMetaEventsCount === null || displayedEventsCount >= traceMetaEventsCount) {
    return null;
  }

  const target = traceEventView.getResultsViewUrlTarget(organization.slug);

  // Number of rows in the trace view. Doesnot include associated errors/issues appearing in
  // txn detail.
  const displayedRowsCount = traceInfo.transactions.size + traceInfo.trailingOrphansCount;

  // Increment by by multiples of 500.
  const increment = displayedRowsCount <= 100 ? 400 : 500;

  const discoverLink = (
    <DiscoverFeature>
      {({hasFeature}) => (
        <StyledLink disabled={!hasFeature} to={target}>
          {t('Discover')}
        </StyledLink>
      )}
    </DiscoverFeature>
  );

  const limitExceededMessage = tct(
    'Limited to a view of [count] rows. To view the full list, go to [discover].',
    {
      count: displayedRowsCount,
      discover: discoverLink,
    }
  );

  const loadBiggerTraceMessage = tct(
    '[loadMore:Show more] of this trace or go to the full list of events in [discover]',
    {
      loadMore: (
        <Button
          priority="link"
          onClick={() => {
            const newLimit = displayedRowsCount + increment;
            if (handleLimitChange) {
              handleLimitChange(newLimit);
            }
            browserHistory.push({
              pathname: location.pathname,
              query: {...location.query, limit: newLimit},
            });
          }}
          aria-label={t('Load more')}
        />
      ),
      discover: discoverLink,
    }
  );

  return (
    <MessageRow>
      {organization.features.includes('trace-view-load-more') &&
      displayedRowsCount < MAX_TRACE_ROWS_LIMIT
        ? loadBiggerTraceMessage
        : limitExceededMessage}
    </MessageRow>
  );
}

const StyledLink = styled(Link)`
  margin-left: 0;
`;

export default LimitExceededMessage;
