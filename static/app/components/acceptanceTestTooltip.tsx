import {useEffect, useState} from 'react';

import Tooltip from 'sentry/components/tooltip';
import {tooltipStore} from 'sentry/stores/tooltipStore';
import domId from 'sentry/utils/domId';

export function AcceptanceTestTooltip(props) {
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
