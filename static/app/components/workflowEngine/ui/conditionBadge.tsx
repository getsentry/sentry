import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const ConditionBadge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.5;
`;
