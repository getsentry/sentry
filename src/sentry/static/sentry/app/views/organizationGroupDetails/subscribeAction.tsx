import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import Tooltip from 'app/components/tooltip';
import {IconBell} from 'app/icons';
import {t} from 'app/locale';
import {Group} from 'app/types';

import {getSubscriptionReason} from './utils';

type Props = {
  group: Group;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
};

function SubscribeAction({group, onClick, className}: Props) {
  const canChangeSubscriptionState = !(group.subscriptionDetails?.disabled ?? false);

  if (!canChangeSubscriptionState) {
    return null;
  }

  const subscribedClassName = `group-subscribe ${group.isSubscribed ? ' active' : ''}`;

  return (
    <Tooltip title={getSubscriptionReason(group, true)}>
      <div
        className={classNames(className, subscribedClassName)}
        title={t('Subscribe')}
        onClick={onClick}
      >
        <IconWrapper>
          <IconBell size="xs" />
        </IconWrapper>
      </div>
    </Tooltip>
  );
}

export default SubscribeAction;

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;
