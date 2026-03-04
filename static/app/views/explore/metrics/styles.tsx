import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import PageFilterBar from 'sentry/components/pageFilters/pageFilterBar';

export const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

export const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

export const FilterBarWithSaveAsContainer = styled(Flex)`
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${p => p.theme.space.md};
`;
