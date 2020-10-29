import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {Group} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import {IconBell} from 'app/icons';
import {t} from 'app/locale';
import Tooltip from 'app/components/tooltip';

import {getSubscriptionReason} from './utils';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};

const SubscribeAction = ({group, onClick}: Props) => {
  const canChangeSubscriptionState = (): boolean => {
    return !(group.subscriptionDetails?.disabled ?? false);
  };

  const subscribedClassName = `group-subscribe btn btn-default btn-sm${
    group.isSubscribed ? ' active' : ''
  }`;

  return (
    canChangeSubscriptionState() && (
      <div className="btn-group">
        <Tooltip title={getSubscriptionReason(group, true)}>
          <div className={subscribedClassName} title={t('Subscribe')} onClick={onClick}>
            <IconWrapper>
              <IconBell size="xs" />
            </IconWrapper>
          </div>
        </Tooltip>
      </div>
    )
  );
};

SubscribeAction.propTypes = {
  group: SentryTypes.Group.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default SubscribeAction;

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;
