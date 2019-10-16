import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Button from 'app/components/button';

import {t} from 'app/locale';

type Props = {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  isSubscribed?: boolean;
  size?: Button['props']['size'];
};

export default class SubscribeButton extends React.Component<Props> {
  static propTypes = {
    isSubscribed: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    size: Button.propTypes.size,
  };

  render() {
    const {size, isSubscribed, onClick, disabled} = this.props;

    return (
      <Button size={size} onClick={onClick} disabled={disabled}>
        <Content>
          <SignalIcon className="icon-signal" isSubscribed={isSubscribed} />
          {isSubscribed ? t('Unsubscribe') : t('Subscribe')}
        </Content>
      </Button>
    );
  }
}

const Content = styled('span')`
  display: flex;
  align-items: center;
`;

const SignalIcon = styled('span')<{isSubscribed?: boolean}>`
  font-size: 1.2em;
  margin-right: 5px;
  ${p => p.isSubscribed && `color: ${p.theme.blue}`};
`;
