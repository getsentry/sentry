import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

export const PurpleTextButton = styled(Button)`
  color: ${p => p.theme.tokens.content.accent};
  font-weight: normal;
  margin: 0 -${p => p.theme.space.md};
  width: fit-content;
`;
