import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Input} from 'sentry/components/core/input';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatSecondsToClock} from 'sentry/utils/duration/formatSecondsToClock';
import {parseClockToSeconds} from 'sentry/utils/duration/parseClockToSeconds';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

function ShareModal({currentTimeSec, Header, Body}: any) {
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

export default function useShareReplayAtTimestamp() {
  const {currentTime} = useReplayContext();

  const handleShare = useCallback(() => {
    // floor() to remove ms level precision. It's a cleaner url by default this way.
    const currentTimeSec = Math.floor(currentTime / 1000);

    openModal(deps => <ShareModal currentTimeSec={currentTimeSec} {...deps} />);
  }, [currentTime]);
  return handleShare;
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
