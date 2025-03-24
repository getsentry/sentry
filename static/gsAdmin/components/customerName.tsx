import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const CustomerName = styled('div')`
  display: grid;
  grid-template: max-content max-content / max-content 1fr;
  gap: ${space(0.5)} ${space(1)};

  > :first-child {
    grid-row: 1 / 3;
  }
`;

export default CustomerName;
