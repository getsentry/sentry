import DiscoverFeature from 'sentry/components/discover/discoverFeature';
import Link from 'sentry/components/links/link';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {TraceInfo} from 'sentry/views/performance/traceDetails/types';

interface LimitExceededMessageProps {
  meta: TraceMeta | null;
  organization: Organization;
  traceEventView: EventView;
  traceInfo: TraceInfo;
}
const LimitExceededMessage = ({
  traceInfo,
  traceEventView,
  organization,
  meta,
}: LimitExceededMessageProps) => {
  const count = traceInfo.transactions.size;
  const totalTransactions = meta?.transactions ?? count;

  if (totalTransactions === null || count >= totalTransactions) {
    return null;
  }

  const target = traceEventView.getResultsViewUrlTarget(organization.slug);

  return (
    <MessageRow>
      {tct(
        'Limited to a view of [count] transactions. To view the full list, [discover].',
        {
          count,
          discover: (
            <DiscoverFeature>
              {({hasFeature}) => (
                <Link disabled={!hasFeature} to={target}>
                  {t('Open in Discover')}
                </Link>
              )}
            </DiscoverFeature>
          ),
        }
      )}
    </MessageRow>
  );
};

export default LimitExceededMessage;
