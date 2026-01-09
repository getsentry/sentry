import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {space} from 'sentry/styles/space';

export const ReadoutRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${space(4)};
  row-gap: ${space(2)};
`;

export function ToolRibbon(props: FlexProps<'div'>) {
  return <Flex wrap="wrap" gap="xl" position="relative" {...props} />;
}
