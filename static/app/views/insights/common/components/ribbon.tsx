import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const ReadoutRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${space(4)};
  row-gap: ${space(2)};
`;

export const ToolRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
`;
