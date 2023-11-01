import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import useProjects from 'sentry/utils/useProjects';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const frames = replay?.getNavigationFrames();
  const projId = replayRecord?.project_id;
  const {projects} = useProjects();
  const projSlug = projects.find(p => p.id === projId)?.slug ?? undefined;

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
      <TextCopyInput size="sm" disabled>
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
              <Link to={`/settings/projects/${projSlug}/security-and-privacy/`}>
                {'Settings, under Security & Privacy'}
              </Link>
            ) : (
              'Settings, under Security & Privacy'
            ),
          }
        )}
        isHoverable
      >
        <TextCopyInput size="sm">{url}</TextCopyInput>
      </Tooltip>
    );
  }

  return <TextCopyInput size="sm">{url}</TextCopyInput>;
}

export default ReplayCurrentUrl;
