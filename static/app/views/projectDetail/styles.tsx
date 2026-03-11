import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {SectionHeading} from 'sentry/components/charts/styles';

export const SidebarSection = styled('section')`
  margin-bottom: ${p => p.theme.space.xl};

  ${SectionHeading} {
    line-height: 1;
  }
`;

export function SectionHeadingWrapper(props: FlexProps) {
  return <Flex justify="between" align="center" {...props} />;
}
