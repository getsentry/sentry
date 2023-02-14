import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const Crumb = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  color: ${p => p.theme.subText};
  padding-right: ${space(1)};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default Crumb;
