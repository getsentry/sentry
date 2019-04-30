import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Link from 'app/components/link';

import {t} from 'app/locale';

export default class SubscribeButton extends React.Component {
  static propTypes = {
    isSubscribed: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  render() {
    const {isSubscribed, onClick} = this.props;
    const subscribeBtnClass = classNames('btn btn-default', {
      subscribed: isSubscribed,
    });

    return (
      <Button className={subscribeBtnClass} onClick={onClick}>
        <Content>
          <SignalIcon className="icon-signal" isSubscribed={isSubscribed} />
          {isSubscribed ? t('Unsubscribe') : t('Subscribe')}
        </Content>
      </Button>
    );
  }
}

const Button = styled(Link)`
  padding: 4px 10px;
`;

const Content = styled('span')`
  display: flex;
  align-items: center;
`;

const SignalIcon = styled('span')`
  font-size: 18px;
  margin-right: 5px;
  ${p => p.isSubscribed && `color: ${p.theme.blue}`};
`;
