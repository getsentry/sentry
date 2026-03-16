import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';

import {FluidHeight} from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = React.ComponentProps<typeof FluidHeight> & {
  error: string;
};

export const FeedbackErrorDetails = styled(({error, ...props}: Props) => (
  <FluidHeight {...props}>
    <Alert.Container>
      <Alert variant="danger">{error}</Alert>
    </Alert.Container>
  </FluidHeight>
))`
  display: grid;
  place-items: center;
`;
