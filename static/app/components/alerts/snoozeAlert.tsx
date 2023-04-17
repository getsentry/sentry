import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  api: Client;
  organization: Organization;
  projectId: string;
  setSnooze: (nextState: boolean) => void;
  setSnoozeCreatedBy: (nextState: string) => void;
  isSnoozed?: boolean;
  ruleId?: string;
};

function SnoozeAlert(props: Props) {
  const {isSnoozed, setSnooze, setSnoozeCreatedBy, api, organization, projectId, ruleId} =
    props;

  function handleMute(target: string) {
    setSnooze(!isSnoozed);
    api.requestPromise(
      `/projects/${organization.slug}/${projectId}/rules/${ruleId}/snooze/`,
      {
        method: 'POST',
        data: {
          target,
        },
      }
    );
    setSnoozeCreatedBy('You');
  }

  function handleUnmute() {
    setSnooze(!isSnoozed);
    api.requestPromise(
      `/projects/${organization.slug}/${projectId}/rules/${ruleId}/snooze/`,
      {
        method: 'DELETE',
      }
    );
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

export default withOrganization(withApi(SnoozeAlert));

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;

const MuteButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;
