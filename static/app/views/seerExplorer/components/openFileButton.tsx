import {IconOpen} from '@sentry/icons/open';

import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {safeURL} from 'sentry/utils/url/safeURL';

/**
 * The URL comes from the backend, so only render http(s) links.
 */
function getSafeFileUrl(url: string | null | undefined): string | undefined {
  const parsed = url ? safeURL(url) : undefined;
  return parsed?.protocol === 'https:' || parsed?.protocol === 'http:'
    ? parsed.href
    : undefined;
}

interface OpenFileButtonProps {
  /**
   * Web URL for the file in its source repository. Renders nothing when missing
   * or not an http(s) URL.
   */
  fileUrl: string | null | undefined;
}

/**
 * Icon button that opens a changed file in its source repository.
 */
export function OpenFileButton({fileUrl}: OpenFileButtonProps) {
  const safeFileUrl = getSafeFileUrl(fileUrl);
  if (!safeFileUrl) {
    return null;
  }

  return (
    <LinkButton
      size="zero"
      variant="transparent"
      icon={<IconOpen size="xs" />}
      aria-label={t('Open file in repository')}
      tooltipProps={{title: t('Open file in repository')}}
      href={safeFileUrl}
      external
      onClick={e => e.stopPropagation()}
    />
  );
}
