import styled from '@emotion/styled';

import type DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

export type RenderSearch = React.ComponentProps<
  typeof DeprecatedAsyncView.prototype.renderSearchInput
>['children'];

export const SearchWrapper = styled('div')`
  display: flex;
  grid-template-columns: 1fr max-content;
  gap: ${p => p.theme.space(1.5)};
  margin-top: ${p => p.theme.space(4)};
  margin-bottom: ${p => p.theme.space(1.5)};
  position: relative;
`;
