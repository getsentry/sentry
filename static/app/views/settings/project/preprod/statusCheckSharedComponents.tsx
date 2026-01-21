import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const SectionLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.onVibrant.light};
  background: ${p => p.theme.tokens.background.accent.vibrant};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.radius.md};
  width: fit-content;
`;
