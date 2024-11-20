import styled from '@emotion/styled';

import {useRollbackPrompts} from 'sentry/components/sidebar/rollback/useRollbackPrompts';

type RollbackNotificationDotProps = {
  collapsed: boolean;
};

export function RollbackNotificationDot({collapsed}: RollbackNotificationDotProps) {
  const {shouldShowDot} = useRollbackPrompts({collapsed});

  if (!shouldShowDot) {
    return null;
  }

  return <Dot />;
}

const Dot = styled('div')`
  width: 11px;
  height: 11px;
  border-radius: 50%;
  position: absolute;
  background-color: #ff45a8;
  left: 25px;
  top: -2px;
`;
