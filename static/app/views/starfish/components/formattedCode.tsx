import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const FormattedCode = styled('div')`
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  overflow-x: auto;
  white-space: pre-wrap;
`;
