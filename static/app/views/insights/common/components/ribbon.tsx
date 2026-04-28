import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

export const ReadoutRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${p => p.theme.space['3xl']};
  row-gap: ${p => p.theme.space.xl};
`;

export function ToolRibbon(props: FlexProps<'div'>) {
  return <Flex wrap="wrap" gap="xl" position="relative" {...props} />;
}
