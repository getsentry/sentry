type TooltipStoreInterface = {
  addTooltip: (tooltip: React.Component) => void;
  removeTooltip: (tooltip: React.Component) => void;
  openAllTooltips: () => boolean;
  closeAllTooltips: () => void;
  tooltips: React.Component[];
  init: () => TooltipStoreInterface;
};

const MAX_TOOLTIPS_TO_OPEN = 100;

const TooltipStore: TooltipStoreInterface = {
  tooltips: [],

  /**
   * Called via window.__openAllTooltips in selenium tests to check tooltip snapshots
   */
  openAllTooltips() {
    if (!this.tooltips.length) {
      return false;
    }
    if (this.tooltips.length > MAX_TOOLTIPS_TO_OPEN) {
      return false; // Pages with too many tooltip components will take too long to render and it isn't likely helpful anyway.
    }
    this.tooltips.forEach(tooltip => {
      tooltip.setState({
        isOpen: true,
        usesGlobalPortal: false,
      });
    });
    return true;
  },

  /**
   * Called via window.__closeAllTooltips in selenium tests to cleanup tooltips after taking a snapshot
   */
  closeAllTooltips() {
    this.tooltips.forEach(tooltip => {
      tooltip.setState({
        isOpen: false,
        usesGlobalPortal: true,
      });
    });
  },

  init(): TooltipStoreInterface {
    window.__openAllTooltips = this.openAllTooltips.bind(this);
    window.__closeAllTooltips = this.closeAllTooltips.bind(this);
    return this;
  },

  addTooltip(tooltip: React.Component) {
    this.tooltips.push(tooltip);
  },

  removeTooltip(tooltip: React.Component) {
    this.tooltips = this.tooltips.filter(t => t !== tooltip);
  },
};

export default TooltipStore.init();
