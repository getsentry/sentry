import React from 'react';

import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import {Group} from 'app/types';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent) => void;
  disabled?: boolean;
  title: string;
};

function SubscribeAction({title, disabled, group, onClick}: Props) {
  const canChangeSubscriptionState = !(group.subscriptionDetails?.disabled ?? false);

  if (!canChangeSubscriptionState) {
    return null;
  }

  return (
    <MenuItemActionLink disabled={disabled} title={title} onClick={onClick}>
      {title}
    </MenuItemActionLink>
  );
}

export default SubscribeAction;
