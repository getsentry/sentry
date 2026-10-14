import styled from '@emotion/styled';

import * as SidebarSection from 'sentry/components/sidebarSection';

export const SidebarSectionTitle = styled(SidebarSection.Title)`
  margin-bottom: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.primary};
`;
