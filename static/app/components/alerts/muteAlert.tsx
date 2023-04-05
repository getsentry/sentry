import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  isMuted: boolean;
};

const dropdownItems: MenuItemProps[] = [
  {
    key: 'me',
    label: t('Mute for me'),
  },
  {
    key: 'everyone',
    label: t('Mute for everyone'),
  },
];
const MuteAlert = ({isMuted}: Props) => {
  if (isMuted) {
    return (
      <Button size="sm" icon={<IconMute />}>
        {t('Unmute')}
      </Button>
    );
  }
  return (
    <ButtonBar>
      <MuteButton size="sm" icon={<IconSound />}>
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
};

export default MuteAlert;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;

const MuteButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;
