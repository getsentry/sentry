import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {IconBell} from 'app/icons';
import {t} from 'app/locale';
import {Group} from 'app/types';

import {getSubscriptionReason} from './utils';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};

function SubscribeAction({group, onClick}: Props) {
  const canChangeSubscriptionState = !(group.subscriptionDetails?.disabled ?? false);

  if (!canChangeSubscriptionState) {
    return null;
  }

  const subscribedClassName = `group-subscribe btn btn-default btn-sm${
    group.isSubscribed ? ' active' : ''
  }`;

  return (
    <div className="btn-group">
      <Tooltip title={getSubscriptionReason(group, true)}>
        <div className={subscribedClassName} title={t('Subscribe')} onClick={onClick}>
          <IconWrapper>
            <IconBell size="xs" />
          </IconWrapper>
        </div>
      </Tooltip>
    </div>
  );
}

export default SubscribeAction;

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;
