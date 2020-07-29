type TooltipStoreInterface = {
  addTooltip: (tooltip: React.Component) => void;
  removeTooltip: (tooltip: React.Component) => void;
  openAllTooltips: () => boolean;
  closeAllTooltips: () => void;
  tooltips: React.Component[];
  init: () => TooltipStoreInterface;
};

const TooltipStore: TooltipStoreInterface = {
  tooltips: [],

  /**
   * Called via window.__openAllTooltips in selenium tests to check tooltip snapshots
   */
  openAllTooltips() {
    if (!this.tooltips.length) {
      return false;
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
