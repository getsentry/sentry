import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import AsyncView from 'app/views/asyncView';

export type RenderSearch = React.ComponentProps<
  typeof AsyncView.prototype.renderSearchInput
>['children'];

export const SearchWrapper = styled('div')`
  display: flex;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1.5)};
  margin-top: ${space(4)};
  margin-bottom: ${space(1.5)};
  position: relative;
`;
