import {useEffect, useState} from 'react';

import {DO_NOT_USE_TOOLTIP, InternalTooltipProps} from 'sentry/components/tooltip';
import {tooltipStore} from 'sentry/stores/tooltipStore';
import domId from 'sentry/utils/domId';

export function AcceptanceTestTooltip(props: InternalTooltipProps) {
  const [forceVisible, setForceVisible] = useState<undefined | boolean>(undefined);

  useEffect(() => {
    const tooltipId = domId('tooltip-');
    tooltipStore.addTooltip(tooltipId, setForceVisible);

    return () => {
      tooltipStore.removeTooltip(tooltipId);
    };
  }, []);

  return <DO_NOT_USE_TOOLTIP forceVisible={forceVisible} {...props} />;
}
