import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

export const Step = styled(Flex)`
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

export const StepLead = styled(Flex)`
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-bottom: ${p => p.theme.space.xs};
`;

export const EmbeddedSelectField = styled(Select)`
  padding: 0;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  text-transform: none;
`;
