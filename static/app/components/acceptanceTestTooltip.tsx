import {useEffect, useState} from 'react';

import Tooltip, {TooltipProps} from 'sentry/components/tooltip';
import {tooltipStore} from 'sentry/stores/tooltipStore';
import domId from 'sentry/utils/domId';

export function AcceptanceTestTooltip(props: TooltipProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const tooltipId = domId('tooltip-');
    tooltipStore.addTooltip(tooltipId, {setOpen});

    return () => {
      tooltipStore.removeTooltip(tooltipId);
    };
  }, []);

  return open ? <Tooltip forceShow={open} {...props} /> : null;
}
