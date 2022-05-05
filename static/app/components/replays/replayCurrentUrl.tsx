import React from 'react';
import styled from '@emotion/styled';

import TextCopyInput from 'sentry/components/forms/textCopyInput';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import space from 'sentry/styles/space';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return null;
  }

  return (
    <UrlCopyInput>
      <TextCopyInput>{getCurrentUrl(replay, currentTime)}</TextCopyInput>
    </UrlCopyInput>
  );
}

const UrlCopyInput = styled('div')`
  & input {
    background: white;
    border: none;
    padding: 0 ${space(0.75)};
    font-size: ${p => p.theme.fontSizeMedium};
    border-bottom-left-radius: 0;
  }
  & button {
    border-top: none;
    border-right: none;
    border-bottom: none;
  }
`;

export default ReplayCurrentUrl;
