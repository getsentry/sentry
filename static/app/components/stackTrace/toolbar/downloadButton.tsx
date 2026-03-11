import {LinkButton} from '@sentry/scraps/button';

import {
  useStackTraceContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface DownloadButtonProps {
  projectSlug: string;
}

/**
 * Download button for native platform raw crash reports (Apple crash report format).
 * Only renders for native platforms (cocoa, objc, swift, etc.) when view === 'raw'.
 */
export function DownloadButton({projectSlug}: DownloadButtonProps) {
  const {view, isMinified} = useStackTraceViewState();
  const ctx = useStackTraceContext();
  const platform = ctx.platform;
  const organization = useOrganization();
  const api = useApi();

  if (!isNativePlatform(platform) || view !== 'raw') {
    return null;
  }

  const href = `${api.baseUrl}/projects/${organization.slug}/${projectSlug}/events/${ctx.event.id}/apple-crash-report?minified=${isMinified}&download=1`;

  return (
    <LinkButton
      size="xs"
      href={href}
      icon={<IconDownload />}
      tooltipProps={{title: t('Download raw stack trace file')}}
    >
      {t('Download')}
    </LinkButton>
  );
}
