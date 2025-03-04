import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Card = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => 'solid ' + p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
  margin: ${space(2)} 0;
  padding: ${space(2)};
`;

export const HalvedGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  align-items: center;
  gap: ${space(4)};
`;

export const HalvedWithDivider = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  align-items: center;
  margin: 8px 0;
`;

export const Divider = styled('span')`
  border-right: 1px solid ${p => p.theme.border};
  margin: 0 ${space(1)};
  height: ${space(3)};
`;

export const Centered = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;
