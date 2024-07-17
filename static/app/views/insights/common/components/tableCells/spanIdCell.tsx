import type {Location} from 'history';

import Link from 'sentry/components/links/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {SPAN_ID_DISPLAY_LENGTH} from 'sentry/views/insights/http/settings';
import type {ModuleName} from 'sentry/views/insights/types';

interface Props {
  location: Location;
  moduleName: ModuleName;
  projectSlug: string;
  spanId: string;
  timestamp: string;
  traceId: string;
  transactionId: string;
  source?: string;
}

export function SpanIdCell({
  moduleName,
  projectSlug,
  traceId,
  transactionId,
  spanId,
  timestamp,
  source,
  location,
}: Props) {
  const organization = useOrganization();
  const url = normalizeUrl(
    generateLinkToEventInTraceView({
      eventId: transactionId,
      projectSlug,
      traceSlug: traceId,
      timestamp,
      organization,
      location,
      spanId,
      source,
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
