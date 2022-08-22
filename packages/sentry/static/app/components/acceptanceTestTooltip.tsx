import {useEffect, useState} from 'react';

import {DO_NOT_USE_TOOLTIP, InternalTooltipProps} from 'sentry/components/tooltip';
import domId from 'sentry/utils/domId';

type Tooltip = {
  id: string;
  setOpen: (isOpen: boolean) => void;
};

/**
 * XXX: This is NOT a reflux store.
 *
 * This is purely used for acceptance tests where we want to open all tooltips
 * in the DOM at once for capturing visual snapshots of tooltips being open.
 */
class TooltipStore {
  tooltips = new Map<string, Tooltip>();

  constructor() {
    window.__openAllTooltips = this.openAllTooltips;
    window.__closeAllTooltips = this.closeAllTooltips;
  }

  /**
   * Called via window.__openAllTooltips in selenium tests to check tooltip snapshots
   */
  openAllTooltips = () => {
    for (const tooltip of this.tooltips.values()) {
      tooltip.setOpen(true);
    }

    return true;
  };

  /**
   * Called via window.__closeAllTooltips in selenium tests to cleanup tooltips
   * after taking a snapshot
   */
  closeAllTooltips = () => {
    for (const tooltip of this.tooltips.values()) {
      tooltip.setOpen(false);
    }

    return true;
  };

  addTooltip(id: string, setOpen: Tooltip['setOpen']) {
    this.tooltips.set(id, {id, setOpen});
  }

  removeTooltip(id: string) {
    this.tooltips.delete(id);
  }
}

const tooltipStore = new TooltipStore();

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
