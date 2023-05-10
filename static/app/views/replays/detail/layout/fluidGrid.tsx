import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

/**
 * The default grid template is `max-content 1fr`, feel free to override it
 * with a prop like: `style={{gridTemplateRows: 'auto 1fr auto'}}`
 */
const FluidGrid = styled('section')`
  display: grid;
  grid-template-rows: max-content 1fr;
  gap: ${space(1)};
  height: 100%;
`;

export default FluidGrid;
