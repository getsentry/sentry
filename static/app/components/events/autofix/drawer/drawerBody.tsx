import type {ReactNode} from 'react';

import {DrawerBody} from 'sentry/components/globalDrawer/components';

interface SeerDrawerBody {
  children: ReactNode;
}

export function SeerDrawerBody({children}: SeerDrawerBody) {
  return <DrawerBody>{children}</DrawerBody>;
}
