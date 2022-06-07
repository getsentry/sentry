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
    return <UrlCopyInput disabled>{''}</UrlCopyInput>;
  }

  return <UrlCopyInput>{getCurrentUrl(replay, currentTime)}</UrlCopyInput>;
}

const UrlCopyInput = styled(TextCopyInput)`
  ${StyledInput} {
    background: ${p => p.theme.white};
    border: none;
    padding: 0 ${space(0.75)};
    font-size: ${p => p.theme.fontSizeMedium};
    border-bottom-left-radius: 0;
    height: ${space(4)};
  }
  ${StyledInput}[disabled] {
    border: none;
  }

  ${StyledCopyButton} {
    border-top: none;
    border-right: none;
    border-bottom: none;
    height: ${space(4)};
    min-height: ${space(4)};
  }
`;

export default ReplayCurrentUrl;
