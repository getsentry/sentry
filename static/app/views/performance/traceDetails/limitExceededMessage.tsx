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
  const count = traceInfo.transactions.size + traceInfo.errors.size;
  const totalEvents = (meta && meta.transactions + meta.errors) ?? count;
  const location = useLocation();

  if (totalEvents === null || count >= totalEvents) {
    return null;
  }

  const target = traceEventView.getResultsViewUrlTarget(organization.slug);

  // Increment by by multiples of 500.
  const increment = count <= 100 ? 400 : 500;
  const currentLimit = location.query.limit
    ? Number(location.query.limit)
    : DEFAULT_TRACE_ROWS_LIMIT; // TODO Abdullah Khan: Use count when extra orphan row bug is fixed.

  const discoverLink = (
    <DiscoverFeature>
      {({hasFeature}) => (
        <StyledLink disabled={!hasFeature} to={target}>
          {t('open in Discover')}
        </StyledLink>
      )}
    </DiscoverFeature>
  );

  const limitExceededMessage = tct(
    'Limited to a view of [count] rows. To view the full list, [discover].',
    {
      count,
      discover: discoverLink,
    }
  );

  const loadBiggerTraceMessage = tct(
    'Click [loadMore:here] to build a view with more rows or to view the full list, [discover].',
    {
      loadMore: (
        <Button
          priority="link"
          onClick={() => {
            const newLimit = currentLimit + increment;
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
      count < MAX_TRACE_ROWS_LIMIT
        ? loadBiggerTraceMessage
        : limitExceededMessage}
    </MessageRow>
  );
}

const StyledLink = styled(Link)`
  margin-left: 0;
`;

export default LimitExceededMessage;
