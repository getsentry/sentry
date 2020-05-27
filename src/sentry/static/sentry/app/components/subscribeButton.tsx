import React from 'react';

import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconBell} from 'app/icons/iconBell';

type Props = {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  isSubscribed?: boolean;
  size?: React.ComponentProps<typeof Button>['size'];
};

export default class SubscribeButton extends React.Component<Props> {
  render() {
    const {size, isSubscribed, onClick, disabled} = this.props;
    const icon = <IconBell color={isSubscribed ? 'blue' : 'black'} />;

    return (
      <Button size={size} icon={icon} onClick={onClick} disabled={disabled}>
        {isSubscribed ? t('Unsubscribe') : t('Subscribe')}
      </Button>
    );
  }
}
