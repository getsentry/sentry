import {LinkButton} from '@sentry/scraps/button';

import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import {useApi} from 'sentry/utils/useApi';

interface RawDownloadActionProps {
  eventId: string;
  organization: Organization;
  projectSlug: string;
}

/**
 * Download button for native crash reports. Renders only when the user has
 * switched to the raw stack trace view on a native platform. Hits the
 * apple-crash-report endpoint with `download=1` so the browser saves the file.
 */
export function RawDownloadAction({
  eventId,
  organization,
  projectSlug,
}: RawDownloadActionProps) {
  const api = useApi();
  const {view, isMinified, platform} = useStackTraceViewState();

  if (view !== 'raw' || !platform || !isNativePlatform(platform)) {
    return null;
  }

  const href = `${api.baseUrl}/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report?minified=${isMinified}&download=1`;

  return (
    <LinkButton
      size="xs"
      href={href}
      tooltipProps={{title: t('Download raw stack trace file')}}
      onClick={() => {
        trackAnalytics('stack-trace.download_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobilePlatform(platform),
        });
      }}
    >
      {t('Download')}
    </LinkButton>
  );
}
