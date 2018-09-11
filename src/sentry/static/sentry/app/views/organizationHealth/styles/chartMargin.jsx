import {css} from 'react-emotion';

import space from 'app/styles/space';

const chartMargin = css`
  margin-right: ${space(2)};
  &:last-child {
    margin-right: 0;
  }
`;

export default chartMargin;
