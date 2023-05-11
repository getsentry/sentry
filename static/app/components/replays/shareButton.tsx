import {useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
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
  const [customSeconds, setSeconds] = useState(currentTimeSec);
  const [shareMode, setShareMode] = useState<'current' | 'user'>('current');

  const url = new URL(window.location.href);
  const {searchParams} = url;
  searchParams.set('referrer', getRouteStringFromRoutes(routes));
  searchParams.set(
    't',
    shareMode === 'user' ? String(customSeconds) : String(currentTimeSec)
  );

  // Use `value` instead of `defaultValue` so the number resets to
  // `currentTimeSec` if the user toggles isCustom
  const value =
    shareMode === 'user'
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

        <ShareAtRadioGroup>
          <RadioGroup
            value={shareMode}
            choices={[
              ['current', 'Share at current timestamp'],
              [
                'user',
                <InputRow key="user">
                  <div>{t('Share at')}</div>
                  <Input
                    name="time"
                    onFocus={() => setShareMode('user')}
                    value={value}
                    onChange={e => {
                      setSeconds(parseClockToSeconds(e.target.value));
                    }}
                  />
                </InputRow>,
              ],
            ]}
            label="share at"
            onChange={id => setShareMode(id)}
          />
        </ShareAtRadioGroup>
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
      size="sm"
      icon={<IconUpload size="sm" />}
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
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  & > div {
    min-width: fit-content;
  }
  & > input {
    width: 100px;
  }
`;

const ShareAtRadioGroup = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: column;
  max-width: fit-content;
`;

export default ShareButton;
