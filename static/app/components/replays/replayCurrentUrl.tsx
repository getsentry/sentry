import React from 'react';
import styled from '@emotion/styled';

import TextCopyInput from 'sentry/components/forms/textCopyInput';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';

function ReplayCurrentUrl() {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return <UrlCopyInput disabled>{''}</UrlCopyInput>;
  }

  const event = replay.getEvent();
  const crumbs = replay.getRawCrumbs();

  return <UrlCopyInput>{getCurrentUrl(event, crumbs, currentTime)}</UrlCopyInput>;
}

const UrlCopyInput = styled(TextCopyInput)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default ReplayCurrentUrl;
