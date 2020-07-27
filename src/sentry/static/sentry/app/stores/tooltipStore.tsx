type TooltipStoreInterface = {
  addTooltip: (tooltip: React.Component) => void;
  removeTooltip: (tooltip: React.Component) => void;
  openAllTooltips: () => boolean;
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

  init(): TooltipStoreInterface {
    window.__openAllTooltips = this.openAllTooltips.bind(this);
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
