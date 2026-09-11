import styled from '@emotion/styled';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';

export const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

export const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
