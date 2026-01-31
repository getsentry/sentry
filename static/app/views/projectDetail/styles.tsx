import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {SectionHeading} from 'sentry/components/charts/styles';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {space} from 'sentry/styles/space';

export const SidebarSection = styled('section')`
  margin-bottom: ${space(2)};

  ${SectionHeading} {
    line-height: 1;
  }
`;

export function SectionHeadingWrapper(props: FlexProps) {
  return <Flex justify="between" align="center" {...props} />;
}

export const SectionHeadingLink = styled(GlobalSelectionLink)`
  display: flex;
`;
