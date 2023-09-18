import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const SideBySide = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
  align-items: flex-start;
`;

export default SideBySide;
