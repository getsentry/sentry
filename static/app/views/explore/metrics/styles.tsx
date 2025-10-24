import styled from '@emotion/styled';

import {Body} from 'sentry/components/layouts/thirds';
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

export const TopSectionBody = styled(Body)`
  padding-bottom: 0;
  flex: 0 0 auto;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding-bottom: ${space(2)};
  }
`;
