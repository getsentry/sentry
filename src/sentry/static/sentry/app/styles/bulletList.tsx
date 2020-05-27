import styled from '@emotion/styled';

import space from 'app/styles/space';

const BulletList = styled('ul')`
  padding: 0;
  list-style: none;

  li {
    position: relative;
    padding-left: 32px;
    margin-bottom: ${space(0.75)};

    &:before {
      content: '';
      position: absolute;
      top: ${space(1)};
      left: ${space(1)};
      display: block;
      height: 8px;
      width: 8px;
      background: ${p => p.theme.gray400};
      border-radius: 50%;
    }
  }
`;

export default BulletList;
