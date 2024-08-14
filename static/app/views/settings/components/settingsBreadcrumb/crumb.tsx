import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const Crumb = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
  position: relative;
  color: ${p => p.theme.subText};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default Crumb;
