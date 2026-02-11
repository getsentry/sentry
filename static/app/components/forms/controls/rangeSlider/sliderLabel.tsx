import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const SliderLabel = styled('label')`
  font-size: 14px;
  margin-bottom: ${space(1)};
  color: ${p => p.theme.tokens.content.secondary};
`;

export default SliderLabel;
