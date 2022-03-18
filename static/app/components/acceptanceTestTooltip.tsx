import {useEffect, useState} from 'react';

import {DO_NOT_USE_TOOLTIP, TooltipProps} from 'sentry/components/tooltip';
import {tooltipStore} from 'sentry/stores/tooltipStore';
import domId from 'sentry/utils/domId';

export function AcceptanceTestTooltip(props: TooltipProps) {
  const [open, setOpen] = useState<undefined | boolean>(undefined);

  useEffect(() => {
    const tooltipId = domId('tooltip-');
    tooltipStore.addTooltip(tooltipId, setOpen);

    return () => {
      tooltipStore.removeTooltip(tooltipId);
    };
  }, []);

  return <DO_NOT_USE_TOOLTIP forceShow={open} {...props} />;
}
