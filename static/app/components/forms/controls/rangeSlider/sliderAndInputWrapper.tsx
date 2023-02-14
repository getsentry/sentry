import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const SliderAndInputWrapper = styled('div')<{showCustomInput?: boolean}>`
  display: grid;
  align-items: center;
  grid-auto-flow: column;
  grid-template-columns: 4fr ${p => p.showCustomInput && '1fr'};
  gap: ${space(1)};
`;

export default SliderAndInputWrapper;
