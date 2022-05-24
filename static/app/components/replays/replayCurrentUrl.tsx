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

const UrlCopyInput = styled(TextCopyInput)<{disabled?: boolean}>`
  ${StyledInput} {
    background: 'white';
    border: none;
    padding: 0 ${space(0.75)};
    font-size: ${p => p.theme.fontSizeMedium};
    border-bottom-left-radius: 0;
    ${p =>
      p.disabled
        ? `
          pointer-events: none;
          background: ${p.theme.backgroundSecondary};
          color: ${p.theme.gray300};
          border: 1px solid ${p.theme.border};
          cursor: not-allowed;
        `
        : ''}
  }

  ${StyledCopyButton} {
    border-top: none;
    border-right: none;
    border-bottom: none;
    ${p => (p.disabled ? 'pointer-events: none;' : '')}
  }
`;

export default ReplayCurrentUrl;
