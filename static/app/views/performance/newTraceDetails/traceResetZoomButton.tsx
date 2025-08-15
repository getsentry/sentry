import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

export function TraceResetZoomButton(props: {
  organization: Organization;
  viewManager: VirtualizedViewManager;
}) {
  const onResetZoom = useCallback(() => {
    traceAnalytics.trackResetZoom(props.organization);
    props.viewManager.resetZoom();
  }, [props.viewManager, props.organization]);

  return (
    <ResetZoomButton
      hide={props.viewManager.reset_zoom_button?.disabled !== false}
      size="xs"
      onClick={onResetZoom}
      ref={props.viewManager.registerResetZoomRef}
    >
      {t('Reset Zoom')}
    </ResetZoomButton>
  );
}

const ResetZoomButton = styled(Button)<{
  hide: boolean;
}>`
  display: ${props => (props.hide ? 'none' : 'block')};

  &[disabled] {
    cursor: not-allowed;
    opacity: 0.65;
  }
`;
