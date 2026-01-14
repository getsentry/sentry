import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {space} from 'sentry/styles/space';

export const PurpleTextButton = styled(Button)`
  color: ${p => p.theme.tokens.content.accent};
  font-weight: normal;
  margin: 0 -${space(1)};
  width: fit-content;
`;
