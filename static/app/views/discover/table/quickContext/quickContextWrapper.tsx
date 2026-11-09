import type {ComponentProps} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {QuickContextHovercard} from './quickContextHovercard';

export function QuickContextHoverWrapper(
  props: ComponentProps<typeof QuickContextHovercard>
) {
  return (
    <Flex align="center" gap="sm">
      <QuickContextHovercard {...props} />
    </Flex>
  );
}
