import styled from '@emotion/styled';

import {Flex, type FlexProps} from 'sentry/components/core/layout';
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

export function FilterBarWithSaveAsContainer(props: FlexProps) {
  return <Flex justify="between" align="center" marginBottom="md" {...props} />;
}
