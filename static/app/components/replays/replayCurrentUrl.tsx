import styled from '@emotion/styled';

import {Input, InputGroup} from 'sentry/components/inputGroup';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput, {
  StyledCopyButton,
  StyledInput,
} from 'sentry/components/textCopyInput';
import space from 'sentry/styles/space';
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
    <UrlCopyInput size="sm">
      {getCurrentUrl(replayRecord, crumbs, currentTime)}
    </UrlCopyInput>
  );
}

const UrlCopyInput = styled(TextCopyInput)`
  font-size: ${p => p.theme.fontSizeMedium};
  column-gap: ${space(1)};

  ${StyledInput} {
    border-right-width: 1px;
    border-radius: 0.25em;
    background-color: ${p => p.theme.background};
    border-right-color: ${p => p.theme.border};

    &:hover,
    &:focus {
      border-right-width: 1px;
      background-color: ${p => p.theme.background};
    }
  }
  ${StyledCopyButton} {
    border-radius: 0.25em;
  }
`;

export default ReplayCurrentUrl;
