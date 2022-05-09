import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';

type Props = React.ComponentProps<typeof Alert>;

// Margin bottom should probably be a different prop
const PanelAlert = styled(({...props}: Props) => <Alert {...props} showIcon system />)`
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
