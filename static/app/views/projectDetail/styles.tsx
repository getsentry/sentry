import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';

export const SidebarSection = styled('section')`
  margin-bottom: ${p => p.theme.space(2)};

  ${SectionHeading} {
    line-height: 1;
  }
`;

export const SectionHeadingWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const SectionHeadingLink = styled(GlobalSelectionLink)`
  display: flex;
`;
