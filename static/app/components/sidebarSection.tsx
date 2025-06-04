import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const Wrap = styled('div')`
  margin-bottom: ${space(4)};
`;

export const Title = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0 0;
`;

export const IconWrapper = styled('div')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;

export const Content = styled('div')`
  margin-top: ${space(1)};
`;
