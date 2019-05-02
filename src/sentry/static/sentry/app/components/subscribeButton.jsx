import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Button from 'app/components/button';

import {t} from 'app/locale';

export default class SubscribeButton extends React.Component {
  static propTypes = {
    isSubscribed: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  render() {
    const {isSubscribed, onClick} = this.props;

    return (
      <Button size="small" onClick={onClick}>
        <Content>
          <SignalIcon className="icon-signal" isSubscribed={isSubscribed} />
          {isSubscribed ? t('Unsubscribe') : t('Subscribe')}
        </Content>
      </Button>
    );
  }
}

const Content = styled('span')`
  font-size: 14px;
  display: flex;
  align-items: center;
`;

const SignalIcon = styled('span')`
  font-size: 18px;
  margin-right: 5px;
  ${p => p.isSubscribed && `color: ${p.theme.blue}`};
`;
