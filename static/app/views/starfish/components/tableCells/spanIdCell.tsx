import Link from 'sentry/components/links/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SPAN_ID_DISPLAY_LENGTH} from 'sentry/views/performance/http/settings';
import type {ModuleName} from 'sentry/views/starfish/types';

interface Props {
  moduleName: ModuleName;
  projectSlug: string;
  spanId: string;
  timestamp: string;
  traceId: string;
  transactionId: string;
}

export function SpanIdCell({
  moduleName,
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
      eventId: transactionId,
      projectSlug,
      traceSlug: traceId,
      timestamp,
      organization,
      location,
      spanId,
    })
  );

  return (
    <Link
      onClick={() =>
        trackAnalytics('performance_views.sample_spans.span_clicked', {
          organization,
          source: moduleName,
        })
      }
      to={url}
    >
      {spanId.slice(0, SPAN_ID_DISPLAY_LENGTH)}
    </Link>
  );
}
