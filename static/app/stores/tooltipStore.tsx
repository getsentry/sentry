type TooltipActions = {
  setOpen: (isOpen: boolean) => void;
  setUseGlobalPortal: (useGlobalPortal: boolean) => void;
};

type Tooltip = {
  actions: TooltipActions;
  id: string;
};

const MAX_TOOLTIPS_TO_OPEN = 100;

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

  getOpenableSingleTooltips() {
    // TODO: We need to figure out how to find "list" tooltips by looking for
    // the `key` like we did before. This was previously done with
    //
    //  const _internals =
    //    (tooltip as any)._reactInternalFiber || (tooltip as any)._reactInternals;
    //
    return [...this.tooltips.values()];
  }

  /**
   * Called via window.__openAllTooltips in selenium tests to check tooltip snapshots
   */
  openAllTooltips = () => {
    const tooltips = this.getOpenableSingleTooltips();

    // Pages with too many tooltip components will take too long to render
    // and it isn't likely helpful anyway.
    if (!tooltips.length || tooltips.length > MAX_TOOLTIPS_TO_OPEN) {
      return false;
    }

    tooltips.forEach(tooltip => {
      tooltip.actions.setUseGlobalPortal(false);
      tooltip.actions.setOpen(true);
    });

    return true;
  };

  /**
   * Called via window.__closeAllTooltips in selenium tests to cleanup tooltips
   * after taking a snapshot
   */
  closeAllTooltips = () => {
    const tooltips = this.getOpenableSingleTooltips();

    tooltips.forEach(tooltip => {
      tooltip.actions.setOpen(false);
      tooltip.actions.setUseGlobalPortal(true);
    });
  };

  addTooltip(id: string, actions: TooltipActions) {
    this.tooltips.set(id, {id, actions});
  }

  removeTooltip(id: string) {
    this.tooltips.delete(id);
  }
}

export const tooltipStore = new TooltipStore();
