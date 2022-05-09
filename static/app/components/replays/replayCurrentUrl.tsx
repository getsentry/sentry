import React from 'react';
import styled from '@emotion/styled';

import TextCopyInput, {
  StyledCopyButton,
  StyledInput,
} from 'sentry/components/forms/textCopyInput';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import space from 'sentry/styles/space';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return null;
  }

  return <UrlCopyInput>{getCurrentUrl(replay, currentTime)}</UrlCopyInput>;
}

const UrlCopyInput = styled(TextCopyInput)`
  ${StyledInput} {
    background: white;
    border: none;
    padding: 0 ${space(0.75)};
    font-size: ${p => p.theme.fontSizeMedium};
    border-bottom-left-radius: 0;
  }

  ${StyledCopyButton} {
    border-top: none;
    border-right: none;
    border-bottom: none;
  }
`;

export default ReplayCurrentUrl;
