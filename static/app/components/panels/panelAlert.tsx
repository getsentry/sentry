import styled from '@emotion/styled';

import type {AlertProps} from 'sentry/components/core/alert';
import {Alert} from 'sentry/components/core/alert';

// Margin bottom should probably be a different prop
// @TODO(jonasbadalic): What is a panel alert, how does it differ from an alert and why do we need it?
const PanelAlert = styled(({...props}: AlertProps) => (
  <Alert.Container>
    <Alert {...props} showIcon system />
  </Alert.Container>
))`
  margin: 0 0 1px 0;
  border-radius: 0;
  box-shadow: none;

  &:last-child {
    border-bottom: none;
    margin: 0;
    border-radius: 0 0 4px 4px;
  }
`;

export default PanelAlert;
