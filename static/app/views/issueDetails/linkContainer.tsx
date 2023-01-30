import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const LinkContainer = styled('span')`
  margin-left: ${space(1)};
  padding-left: ${space(1)};
  position: relative;
  font-weight: normal;

  &:before {
    display: block;
    position: absolute;
    content: '';
    left: 0;
    top: 2px;
    height: 14px;
    border-left: 1px solid ${p => p.theme.border};
  }
`;

export default LinkContainer;
