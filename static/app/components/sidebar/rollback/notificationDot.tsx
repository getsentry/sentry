import styled from '@emotion/styled';

export function RollbackNotificationDot() {
  return <Dot data-test-id="rollback-notification-dot" />;
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
