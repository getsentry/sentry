import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';

export const HoverWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

export function QuickContextHoverWrapper(
  props: ComponentProps<typeof QuickContextHovercard>
) {
  return (
    <HoverWrapper>
      <QuickContextHovercard {...props} />
    </HoverWrapper>
  );
}
