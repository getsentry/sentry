import {useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
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

  const [disabled, setDisabled] = useState(false);

  async function handleMute(target: 'me' | 'everyone') {
    setDisabled(true);
    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/snooze/`,
        {
          method: 'POST',
          data: {
            target,
          },
        }
      );

      setDisabled(false);
      onSnooze({
        snooze: !isSnoozed,
        snoozeCreatedBy: 'You',
        snoozeForEveryone: target === 'me' ? false : true,
      });
    } catch (err) {
      if (err.status === 403) {
        addErrorMessage(t('You do not have permission to mute this alert'));
      }
      Sentry.captureException(err);
    }
  }

  async function handleUnmute() {
    setDisabled(true);

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/rules/${ruleId}/snooze/`,
        {
          method: 'DELETE',
        }
      );

      setDisabled(false);
      onSnooze({snooze: !isSnoozed});
    } catch (err) {
      if (err.status === 403) {
        addErrorMessage(t('You do not have permission to unmute this alert'));
      }
      Sentry.captureException(err);
    }
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
      <Button
        size="sm"
        icon={<IconMute />}
        disabled={disabled}
        onClick={() => handleUnmute()}
      >
        {t('Unmute')}
      </Button>
    );
  }
  return (
    <ButtonBar>
      <MuteButton
        size="sm"
        icon={<IconSound />}
        disabled={disabled}
        onClick={() => handleMute('me')}
      >
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
        isDisabled={disabled}
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
