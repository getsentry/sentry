import * as React from 'react';

import Button, {ButtonProps} from 'sentry/components/button';
import {IconBell} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  isSubscribed?: boolean;
  size?: ButtonProps['size'];
};

export default class SubscribeButton extends React.Component<Props> {
  render() {
    const {size, isSubscribed, onClick, disabled} = this.props;
    const icon = <IconBell color={isSubscribed ? 'blue300' : undefined} />;

    return (
      <Button size={size} icon={icon} onClick={onClick} disabled={disabled}>
        {isSubscribed ? t('Unsubscribe') : t('Subscribe')}
      </Button>
    );
  }
}
