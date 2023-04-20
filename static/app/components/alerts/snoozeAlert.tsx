import {useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
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
  const location = useLocation();

  const [disabled, setDisabled] = useState(false);

  const handleMute = useCallback(
    async (target: 'me' | 'everyone', autoMute = false) => {
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

        if (autoMute) {
          browserHistory.replace({
            pathname: location.pathname,
            query: {...location.query, mute: undefined},
          });
        }

        setDisabled(false);
        addSuccessMessage(t('Alert muted'));
        onSnooze({
          snooze: !isSnoozed,
          snoozeCreatedBy: 'You',
          snoozeForEveryone: target === 'me' ? false : true,
        });
      } catch (err) {
        if (err.status === 403) {
          addErrorMessage(t('You do not have permission to mute this alert'));
        } else if (err.status === 410) {
          addErrorMessage(t('This alert has already been muted'));
        } else {
          addErrorMessage(t('Unable to mute this alert'));
        }
      }
    },
    [
      api,
      isSnoozed,
      location.pathname,
      location.query,
      onSnooze,
      organization.slug,
      projectSlug,
      ruleId,
    ]
  );

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
      addSuccessMessage(t('Alert unmuted'));
      onSnooze({snooze: !isSnoozed});
    } catch (err) {
      if (err.status === 403) {
        addErrorMessage(t('You do not have permission to unmute this alert'));
      } else {
        addErrorMessage(t('Unable to unmute this alert'));
      }
    }
  }

  useEffect(() => {
    if (location.query.mute === '1' && !isSnoozed) {
      handleMute('me', true);
    }
  }, [location.query, isSnoozed, handleMute]);

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
