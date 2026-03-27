import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {
  isContinuousProfileReference,
  isTransactionProfileReference,
} from 'sentry/utils/profiling/guards/profile';

// The footer component is a sibling of this div.
// Remove it so the flamegraph can take up the
// entire screen.
export const LayoutPageWithHiddenFooter = styled(Layout.Page)`
  ~ footer {
    display: none;
  }
`;

export function requestAnimationFrameTimeout(cb: () => void, timeout: number) {
  const rafId = {current: 0};
  const start = performance.now();

  function timer() {
    if (rafId.current) {
      window.cancelAnimationFrame(rafId.current);
    }
    if (performance.now() - start > timeout) {
      cb();
      return;
    }
    rafId.current = window.requestAnimationFrame(timer);
  }

  rafId.current = window.requestAnimationFrame(timer);
  return rafId;
}

export function getProfileTargetId(reference: Profiling.BaseProfileReference): string {
  if (isTransactionProfileReference(reference)) {
    return reference.profile_id;
  }
  if (isContinuousProfileReference(reference)) {
    return reference.profiler_id;
  }
  return reference;
}
