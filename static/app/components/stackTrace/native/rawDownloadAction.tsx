import {LinkButton} from '@sentry/scraps/button';

import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';
import {resolveHostname} from 'sentry/utils/api/resolveHostname';
import {isMobilePlatform} from 'sentry/utils/platform';

import {supportsAppleCrashReport} from './appleCrashReport';

interface RawDownloadActionProps {
  eventId: string;
  organization: Organization;
  projectSlug: string;
  platform?: PlatformKey;
  threadId?: number;
}

/**
 * Download button for native crash reports. Renders only when the user has
 * switched to the raw stack trace view on a native platform. Hits the
 * apple-crash-report endpoint with `download=1` so the browser saves the file.
 */
export function RawDownloadAction({
  eventId,
  organization,
  platform: platformProp,
  projectSlug,
  threadId,
}: RawDownloadActionProps) {
  const {view, isMinified, platform: viewStatePlatform} = useStackTraceViewState();
  const platform = platformProp ?? viewStatePlatform;

  if (view !== 'raw' || !supportsAppleCrashReport(platform)) {
    return null;
  }

  const threadIdQuery = threadId === undefined ? '' : `&thread_id=${threadId}`;
  const href = resolveHostname(
    `/api/0/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report?minified=${isMinified}${threadIdQuery}&download=1`
  );

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
