import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {space} from 'sentry/styles/space';

export const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

export const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

export const FilterBarWithSaveAsContainer = styled(Flex)`
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;
