import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

const ReplayCurrentUrl = () => {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return (
      <TextCopyInput size="sm" disabled>
        {''}
      </TextCopyInput>
    );
  }

  const replayRecord = replay.getReplay();
  const crumbs = replay.getRawCrumbs();

  return (
    <TextCopyInput size="sm">
      {getCurrentUrl(replayRecord, crumbs, currentTime)}
    </TextCopyInput>
  );
};

export default ReplayCurrentUrl;
