import styled from '@emotion/styled';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput, {
  StyledCopyButton,
  StyledInput,
} from 'sentry/components/textCopyInput';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return (
      <UrlCopyInput size="sm" disabled>
        {''}
      </UrlCopyInput>
    );
  }

  const replayRecord = replay.getReplay();
  const crumbs = replay.getRawCrumbs();

  const url = getCurrentUrl(replayRecord, crumbs, currentTime);
  return (
    <Tooltip title={url} isHoverable showOnlyOnOverflow>
      <UrlCopyInput size="sm">{url}</UrlCopyInput>
    </Tooltip>
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
