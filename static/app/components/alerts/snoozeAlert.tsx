import {useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
import {RuleActionsCategories} from 'sentry/types/alerts';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  hasAccess: boolean;
  isSnoozed: boolean;
  onSnooze: (nextState: {
    snooze: boolean;
    snoozeCreatedBy?: string;
    snoozeForEveryone?: boolean;
  }) => void;
  projectSlug: string;
  ruleActionCategory: RuleActionsCategories;
  type: 'issue' | 'metric';
  disabled?: boolean;
  ruleId?: string;
};

function SnoozeAlert({
  isSnoozed,
  onSnooze,
  projectSlug,
  ruleId,
  ruleActionCategory,
  hasAccess,
  type,
  disabled: alwaysDisabled,
}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const location = useLocation();

  const [disabled, setDisabled] = useState(false);

  const alertPath = type === 'issue' ? 'rules' : 'alert-rules';

  const handleMute = useCallback(
    async (target: 'me' | 'everyone', autoMute = false) => {
      setDisabled(true);
      try {
        await api.requestPromise(
          `/projects/${organization.slug}/${projectSlug}/${alertPath}/${ruleId}/snooze/`,
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
      alertPath,
    ]
  );

  async function handleUnmute() {
    setDisabled(true);

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/${alertPath}/${ruleId}/snooze/`,
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

  const primaryMuteAction =
    ruleActionCategory === RuleActionsCategories.ALL_DEFAULT ? 'me' : 'everyone';

  useEffect(() => {
    if (location.query.mute === '1' && !isSnoozed) {
      handleMute(primaryMuteAction, true);
    }
  }, [location.query, isSnoozed, handleMute, primaryMuteAction]);

  const dropdownItems: MenuItemProps[] = [
    {
      key: 'me',
      label: t('Mute for me'),
      onAction: () => handleMute('me'),
      // Hidden if all default actions because it will be the primary button and no default actions since it shouldn't be an option
      hidden: ruleActionCategory !== RuleActionsCategories.SOME_DEFAULT,
    },
    {
      key: 'everyone',
      label: t('Mute for everyone'),
      onAction: () => handleMute('everyone'),
      // Hidden if some default or no default actions since it will be the primary button, not in dropdown
      hidden: ruleActionCategory !== RuleActionsCategories.ALL_DEFAULT,
    },
  ];

  const hasDropdown = dropdownItems.filter(item => !item.hidden).length > 0;

  if (isSnoozed) {
    return (
      <Button
        size="sm"
        icon={<IconMute />}
        disabled={alwaysDisabled || disabled || !hasAccess}
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
        disabled={alwaysDisabled || disabled || !hasAccess}
        hasDropdown={hasDropdown}
        onClick={() => {
          handleMute(primaryMuteAction);
        }}
      >
        {primaryMuteAction === 'me' ? t('Mute for me') : t('Mute for everyone')}
      </MuteButton>
      {ruleActionCategory !== RuleActionsCategories.NO_DEFAULT && (
        <DropdownMenu
          size="sm"
          trigger={triggerProps => (
            <DropdownTrigger
              {...triggerProps}
              size="sm"
              aria-label={t('Mute alert options')}
              icon={<IconChevron direction="down" />}
            />
          )}
          items={dropdownItems}
          isDisabled={alwaysDisabled || disabled || !hasAccess}
        />
      )}
    </ButtonBar>
  );
}

export default SnoozeAlert;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;

const MuteButton = styled(Button)<{hasDropdown: boolean}>`
  box-shadow: none;
  border-radius: ${p =>
    p.hasDropdown ? p.theme.borderRadiusLeft : p.theme.borderRadius};
`;
