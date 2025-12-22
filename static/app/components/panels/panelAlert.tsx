import styled from '@emotion/styled';

import type {AlertProps} from 'sentry/components/core/alert';
import {Alert} from 'sentry/components/core/alert';

// Margin bottom should probably be a different prop
// @TODO(jonasbadalic): What is a panel alert, how does it differ from an alert and why do we need it?
const PanelAlert = styled((props: Omit<AlertProps, 'system' | 'showIcon'>) => (
  <Alert.Container>
    <Alert {...props} system />
  </Alert.Container>
))`
  margin: 0 0 1px 0;

  &:last-child {
    margin: 0;
  }
`;

export default PanelAlert;
