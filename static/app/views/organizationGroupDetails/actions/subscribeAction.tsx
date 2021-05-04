import * as React from 'react';

import ActionButton from 'app/components/actions/button';
import {IconBell} from 'app/icons';
import {t} from 'app/locale';
import {Group} from 'app/types';

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
      priority={group.isSubscribed ? 'primary' : 'default'}
      size="zero"
      label={t('Subscribe')}
      onClick={onClick}
      icon={<IconBell size="xs" />}
    />
  );
}

export default SubscribeAction;
