import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import AsyncView from 'sentry/views/asyncView';

export type RenderSearch = React.ComponentProps<
  typeof AsyncView.prototype.renderSearchInput
>['children'];

export const SearchWrapper = styled('div')`
  display: flex;
  grid-template-columns: 1fr max-content;
  gap: ${space(1.5)};
  margin-top: ${space(4)};
  margin-bottom: ${space(1.5)};
  position: relative;
`;
