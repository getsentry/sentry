import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const frames = replay?.getNavigationFrames();

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
        title={t(
          'Warning! This URL contains content scrubbed by our PII filters and may no longer be valid. You can turn this off in your Settings, under Security & Privacy.'
        )}
      >
        <TextCopyInput size="sm">{url}</TextCopyInput>
      </Tooltip>
    );
  }

  return <TextCopyInput size="sm">{url}</TextCopyInput>;
}

export default ReplayCurrentUrl;
