import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';

export const PurpleTextButton = styled(Button)`
  color: ${p => p.theme.purple300};
  font-weight: normal;
  padding: 0;
  width: fit-content;
`;
