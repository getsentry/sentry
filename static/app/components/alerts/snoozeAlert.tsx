import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {IconMute, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  type: 'issue' | 'metric';
  disabled?: boolean;
  ruleId?: string;
};

function SnoozeAlert({
  isSnoozed,
  onSnooze,
  projectSlug,
  ruleId,
  hasAccess,
  type,
  disabled: alwaysDisabled,
}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();

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
          navigate(
            {
              pathname: location.pathname,
              query: {...location.query, mute: undefined},
            },
            {replace: true}
          );
        }

        setDisabled(false);
        addSuccessMessage(t('Alert muted'));
        onSnooze({
          snooze: !isSnoozed,
          snoozeCreatedBy: 'You',
          snoozeForEveryone: target === 'me' ? false : true,
        });
      } catch (err: any) {
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
      navigate,
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
    } catch (err: any) {
      if (err.status === 403) {
        addErrorMessage(t('You do not have permission to unmute this alert'));
      } else {
        addErrorMessage(t('Unable to unmute this alert'));
      }
    }
  }

  const primaryMuteAction = 'everyone';

  useEffect(() => {
    if (location.query.mute === '1' && !isSnoozed) {
      handleMute(primaryMuteAction, true);
    }
  }, [location.query, isSnoozed, handleMute, primaryMuteAction]);

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
    <ButtonBar gap="0">
      <MuteButton
        size="sm"
        icon={<IconSound />}
        disabled={alwaysDisabled || disabled || !hasAccess}
        hasDropdown={false}
        onClick={() => {
          handleMute(primaryMuteAction);
        }}
      >
        {t('Mute for everyone')}
      </MuteButton>
    </ButtonBar>
  );
}

export default SnoozeAlert;

const MuteButton = styled(Button)<{hasDropdown: boolean}>`
  box-shadow: none;
  border-radius: ${p =>
    p.hasDropdown ? `${p.theme.radius.md} 0 0 ${p.theme.radius.md}` : p.theme.radius.md};
`;
