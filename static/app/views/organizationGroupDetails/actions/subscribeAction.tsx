import * as React from 'react';

import ActionButton from 'sentry/components/actions/button';
import {IconBell} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Group} from 'sentry/types';

import {getSubscriptionReason} from '../utils';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent) => void;
  disabled?: boolean;
};

function SubscribeAction({disabled, group, onClick}: Props) {
  const canChangeSubscriptionState = !(group.subscriptionDetails?.disabled ?? false);

  if (!canChangeSubscriptionState) {
    return null;
  }

  return (
    <ActionButton
      disabled={disabled}
      title={getSubscriptionReason(group, true)}
      tooltipProps={{delay: 300}}
      priority={group.isSubscribed ? 'primary' : 'default'}
      size="zero"
      label={t('Subscribe')}
      onClick={onClick}
      icon={<IconBell size="xs" />}
    />
  );
}

export default SubscribeAction;
