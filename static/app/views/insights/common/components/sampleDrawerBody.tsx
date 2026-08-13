import styled from '@emotion/styled';

import {DrawerBody} from '@sentry/scraps/drawer';
import {Grid, type GridProps} from '@sentry/scraps/layout';

/**
 * Height-constrained shell so the drawer body becomes the real scroller.
 * Without this, overflow:auto + overscroll-behavior:contain on the body traps
 * wheel events while the panel scrollbar stays inert.
 */
export function SampleDrawerContainer(props: GridProps) {
  return <Grid height="100%" rows="max-content auto" {...props} />;
}

export const SampleDrawerBody = styled(DrawerBody)`
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-direction: column;
  min-height: 0;
`;
