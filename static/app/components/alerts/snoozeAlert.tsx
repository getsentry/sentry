import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  isSnoozed: boolean;
  onSnooze: (nextState: {
    snooze: boolean;
    snoozeCreatedBy?: string;
    snoozeForEveryone?: boolean;
  }) => void;
  projectSlug: string;
  ruleId: string;
};

function SnoozeAlert({isSnoozed, onSnooze, projectSlug, ruleId}: Props) {
  const organization = useOrganization();
  const api = useApi();
  function handleMute(target: string) {
    try {
      api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/snooze/`,
        {
          method: 'POST',
          data: {
            target,
          },
        }
      );
    } catch (err) {
      Sentry.captureException(err);
      return;
    }
    onSnooze({
      snooze: !isSnoozed,
      snoozeCreatedBy: 'You',
      snoozeForEveryone: target === 'me' ? false : true,
    });
  }

  function handleUnmute() {
    try {
      api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/snooze/`,
        {
          method: 'DELETE',
        }
      );
    } catch (err) {
      Sentry.captureException(err);
      return;
    }
    onSnooze({snooze: !isSnoozed});
  }

  const dropdownItems: MenuItemProps[] = [
    {
      key: 'me',
      label: t('Mute for me'),
      onAction: () => handleMute('me'),
    },
    {
      key: 'everyone',
      label: t('Mute for everyone'),
      onAction: () => handleMute('everyone'),
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
      <MuteButton size="sm" icon={<IconSound />} onClick={() => handleMute('me')}>
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
