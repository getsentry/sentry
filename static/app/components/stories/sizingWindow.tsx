import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {space} from 'sentry/styles/space';

const SizingWindow = styled(NegativeSpaceContainer)`
  border: 1px solid ${p => p.theme.yellow400};
  border-radius: ${p => p.theme.borderRadius};

  resize: both;
  padding: ${space(2)};
`;

export default SizingWindow;
