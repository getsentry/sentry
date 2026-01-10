import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const SectionLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.white};
  background: ${p => p.theme.purple300};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.radius.md};
  width: fit-content;
`;
