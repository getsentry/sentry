import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const frames = replay?.getNavigationFrames();
  const projId = replayRecord?.project_id;
  const {projects} = useProjects();
  const projSlug = projects.find(p => p.id === projId)?.slug ?? undefined;
  const organization = useOrganization();

  const url = useMemo(() => {
    try {
      return getCurrentUrl(replayRecord, frames, currentTime);
    } catch (err) {
      Sentry.captureException(err);
      return '';
    }
  }, [replayRecord, frames, currentTime]);

  if (!replay || !url) {
    return (
      <TextCopyInput aria-label={t('Current URL')} size="sm" disabled>
        {''}
      </TextCopyInput>
    );
  }

  if (url.includes('[Filtered]')) {
    return (
      <Tooltip
        title={tct(
          "Funny looking URL? It contains content scrubbed by our [filters] and may no longer be valid. This is to protect your users' privacy. If necessary, you can turn this off in your [settings].",
          {
            filters: (
              <ExternalLink href="https://docs.sentry.io/product/data-management-settings/scrubbing/server-side-scrubbing/">
                {'Data Scrubber'}
              </ExternalLink>
            ),
            settings: projSlug ? (
              <Link
                to={normalizeUrl(
                  `/settings/${organization.slug}/projects/${projSlug}/security-and-privacy/`
                )}
              >
                {'Settings, under Security & Privacy'}
              </Link>
            ) : (
              'Settings, under Security & Privacy'
            ),
          }
        )}
        isHoverable
      >
        <TextCopyInput aria-label={t('Current URL')} size="sm">
          {url}
        </TextCopyInput>
      </Tooltip>
    );
  }

  return (
    <TextCopyInput aria-label={t('Current URL')} size="sm">
      {url}
    </TextCopyInput>
  );
}

export default ReplayCurrentUrl;
