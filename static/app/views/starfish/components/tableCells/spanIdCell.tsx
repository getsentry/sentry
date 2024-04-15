import Link from 'sentry/components/links/link';
import EventView from 'sentry/utils/discover/eventView';
import {
  generateEventSlug,
  generateLinkToEventInTraceView,
} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SPAN_ID_DISPLAY_LENGTH} from 'sentry/views/performance/http/settings';

interface Props {
  projectSlug: string;
  spanId: string;
  timestamp: string;
  traceId: string;
  transactionId: string;
}

export function SpanIdCell({
  projectSlug,
  traceId,
  transactionId,
  spanId,
  timestamp,
}: Props) {
  const organization = useOrganization();
  const location = useLocation();

  const url = normalizeUrl(
    generateLinkToEventInTraceView({
      eventSlug: generateEventSlug({
        id: transactionId,
        project: projectSlug,
      }),
      organization,
      location,
      eventView: EventView.fromLocation(location),
      dataRow: {
        id: transactionId,
        trace: traceId,
        timestamp,
      },
      spanId,
    })
  );

  return <Link to={url}>{spanId.slice(0, SPAN_ID_DISPLAY_LENGTH)}</Link>;
}
