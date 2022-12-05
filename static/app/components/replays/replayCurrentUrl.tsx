import {Input, InputGroup} from 'sentry/components/inputGroup';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return (
      <InputGroup>
        <Input readOnly disabled size="sm" />
      </InputGroup>
    );
  }

  const replayRecord = replay.getReplay();
  const crumbs = replay.getRawCrumbs();

  return (
    <TextCopyInput size="sm">
      {getCurrentUrl(replayRecord, crumbs, currentTime)}
    </TextCopyInput>
  );
}

export default ReplayCurrentUrl;
