import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends ComponentProps<typeof FluidHeight> {
  error: string;
}

const FeedbackErrorDetails = styled(({error, ...props}: Props) => (
  <FluidHeight {...props}>
    <Alert type="error" showIcon>
      {error}
    </Alert>
  </FluidHeight>
))`
  display: grid;
  place-items: center;
`;

export default FeedbackErrorDetails;
