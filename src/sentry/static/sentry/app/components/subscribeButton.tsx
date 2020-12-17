import React from 'react';
import PropTypes from 'prop-types';

import Button from 'app/components/button';
import {IconBell} from 'app/icons';
import {t} from 'app/locale';

type Props = {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  isSubscribed?: boolean;
  size?: React.ComponentProps<typeof Button>['size'];
};

export default class SubscribeButton extends React.Component<Props> {
  static propTypes = {
    isSubscribed: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    // `Object is possibly 'undefined'` if we try to use Button.propTypes.size
    size: PropTypes.any,
  };

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
