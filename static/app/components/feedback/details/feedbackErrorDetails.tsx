import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends ComponentProps<typeof FluidHeight> {
  error: string;
}

const FeedbackErrorDetails = styled(({error, ...props}: Props) => (
  <FluidHeight {...props}>
    <Alert.Container>
      <Alert margin type="error" showIcon>
        {error}
      </Alert>
    </Alert.Container>
  </FluidHeight>
))`
  display: grid;
  place-items: center;
`;

export default FeedbackErrorDetails;
