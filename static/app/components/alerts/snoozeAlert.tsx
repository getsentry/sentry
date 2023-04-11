import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  setSnooze: (nextState: boolean) => void;
  isSnoozed?: boolean;
};

function SnoozeAlert({isSnoozed, setSnooze}: Props) {
  function handleMuteForMe() {
    setSnooze(!isSnoozed);
  }
  function handleMuteForEveryone() {
    setSnooze(!isSnoozed);
  }

  function handleUnmute() {
    setSnooze(!isSnoozed);
  }
  const dropdownItems: MenuItemProps[] = [
    {
      key: 'me',
      label: t('Mute for me'),
      onAction: () => handleMuteForMe(),
    },
    {
      key: 'everyone',
      label: t('Mute for everyone'),
      onAction: () => handleMuteForEveryone(),
    },
  ];

  if (isSnoozed) {
    return (
      <Button size="sm" icon={<IconMute />} onClick={() => handleUnmute()}>
        {t('Unmute')}
      </Button>
    );
  }
  return (
    <ButtonBar>
      <MuteButton size="sm" icon={<IconSound />} onClick={() => handleMuteForMe()}>
        {t('Mute')}
      </MuteButton>
      <DropdownMenu
        size="sm"
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Mute alert options')}
            icon={<IconChevron direction="down" size="xs" />}
          />
        )}
        items={dropdownItems}
        isDisabled={false}
      />
    </ButtonBar>
  );
}

export default SnoozeAlert;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;

const MuteButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;
