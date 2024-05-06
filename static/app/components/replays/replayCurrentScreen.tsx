import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import getCurrentScreenName from 'sentry/utils/replays/getCurrentScreenName';

// Screen name component for video/mobile replays - mirrors replayCurrentUrl.tsx
function ReplayCurrentScreen() {
  const {currentTime, replay} = useReplayContext();
  const frames = replay?.getMobileNavigationFrames();

  const screenName = useMemo(() => {
    try {
      return getCurrentScreenName(frames, currentTime);
    } catch (err) {
      Sentry.captureException(err);
      return '';
    }
  }, [frames, currentTime]);

  if (!replay || !screenName) {
    return (
      <TextCopyInput aria-label={t('Current Screen Name')} size="sm" disabled>
        {''}
      </TextCopyInput>
    );
  }

  return (
    <TextCopyInput aria-label={t('Current Screen Name')} size="sm">
      {screenName}
    </TextCopyInput>
  );
}

export default ReplayCurrentScreen;
