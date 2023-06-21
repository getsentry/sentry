import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const CountTooltipContent = styled('dl')`
  display: grid;
  grid-template-columns: 1fr minmax(auto, max-content);
  gap: ${space(1)} ${space(3)};
  text-align: left;
  align-items: start;
  margin-bottom: 0;
`;

export default CountTooltipContent;
