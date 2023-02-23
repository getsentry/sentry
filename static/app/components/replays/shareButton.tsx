import {useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import Input from 'sentry/components/input';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatSecondsToClock, parseClockToSeconds} from 'sentry/utils/formatters';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

function ShareModal({currentTimeSec, Header, Body}) {
  const routes = useRoutes();
  const [isCustom, setIsCustom] = useState(false);
  const [customSeconds, setSeconds] = useState(currentTimeSec);

  const url = new URL(window.location.href);
  const {searchParams} = url;
  searchParams.set('referrer', getRouteStringFromRoutes(routes));
  searchParams.set('t', isCustom ? String(customSeconds) : currentTimeSec);

  // Use `value` instead of `defaultValue` so the number resets to
  // `currentTimeSec` if the user toggles isCustom
  const value = isCustom
    ? formatSecondsToClock(customSeconds, {padAll: false})
    : formatSecondsToClock(currentTimeSec, {padAll: false});

  return (
    <div>
      <Header>
        <h3>Share Replay</h3>
      </Header>
      <Body>
        <StyledTextCopyInput aria-label={t('Deeplink to current timestamp')} size="sm">
          {url.toString()}
        </StyledTextCopyInput>

        <InputRow>
          <StyledCheckbox
            id="replay_share_custom_time"
            name="replay_share_custom_time"
            checked={isCustom}
            onChange={() => setIsCustom(prev => !prev)}
          />
          <StyledLabel htmlFor="replay_share_custom_time">{t('Start at')}</StyledLabel>
          <StyledInput
            name="time"
            placeholder=""
            disabled={!isCustom}
            value={value}
            onChange={e => setSeconds(parseClockToSeconds(e.target.value))}
          />
        </InputRow>
      </Body>
    </div>
  );
}

function ShareButton() {
  // Cannot use this hook inside the modal because context will not be wired up
  const {currentTime} = useReplayContext();

  // floor() to remove ms level precision. It's a cleaner url by default this way.
  const currentTimeSec = Math.floor(currentTime / 1000);

  return (
    <Button
      size="xs"
      icon={<IconUpload size="xs" />}
      onClick={() =>
        openModal(deps => <ShareModal currentTimeSec={currentTimeSec} {...deps} />)
      }
    >
      {t('Share')}
    </Button>
  );
}

const StyledTextCopyInput = styled(TextCopyInput)`
  /* Keep height consistent with the other input in the modal */
  input {
    height: 38px;
  }
`;

const InputRow = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
`;

const StyledCheckbox = styled(Checkbox)`
  margin: 0 !important;
`;

const StyledLabel = styled('label')`
  margin: 0;
`;

const StyledInput = styled(Input)`
  width: auto;
  max-width: 90px;
`;

export default ShareButton;
