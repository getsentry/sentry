import styled from '@emotion/styled';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import space from 'app/styles/space';

export const SidebarSection = styled('section')`
  margin-bottom: ${space(2)};
`;

export const SectionHeadingWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const SectionHeadingLink = styled(GlobalSelectionLink)`
  display: flex;
`;
