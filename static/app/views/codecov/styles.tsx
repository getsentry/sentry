import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const InlineCodeSnippet = styled('span')`
  background-color: ${p => p.theme.black};
  color: ${p => p.theme.white};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeightNormal};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} 10px;
  line-height: 1;
  position: relative;
  top: -2px;
`;
