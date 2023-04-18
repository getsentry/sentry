import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
// import withOrganization from 'sentry/utils/withOrganization';
import useOrganization from 'sentry/utils/useOrganization';
// import {Organization} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  isSnoozed: boolean;
  // organization: Organization;
  projectId: string;
  ruleId: string;
  setSnooze: (nextState: boolean) => void;
  setSnoozeCreatedBy: (nextState: string) => void;
};

function SnoozeAlert({
  isSnoozed,
  setSnooze,
  setSnoozeCreatedBy,
  api,
  // organization,
  projectId,
  ruleId,
}: Props) {
  const organization = useOrganization();
  function handleMute(target: string) {
    try {
      api.requestPromise(
        `/projects/${organization.slug}/${projectId}/rules/${ruleId}/snooze/`,
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
    setSnooze(!isSnoozed);
    setSnoozeCreatedBy('You');
  }

  function handleUnmute() {
    try {
      api.requestPromise(
        `/projects/${organization.slug}/${projectId}/rules/${ruleId}/snooze/`,
        {
          method: 'DELETE',
        }
      );
    } catch (err) {
      Sentry.captureException(err);
      return;
    }
    setSnooze(!isSnoozed);
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

export default withApi(SnoozeAlert);

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;

const MuteButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;
