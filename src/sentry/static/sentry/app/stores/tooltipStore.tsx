import Reflux from 'reflux';

import Tooltip from 'app/components/tooltip';

type TooltipStoreInterface = {
  addTooltip: (tooltip: Tooltip) => void;
  removeTooltip: (tooltip: Tooltip) => void;
  openAllTooltips: () => boolean;
  tooltips: Tooltip[];
};

const tooltipStore: Reflux.StoreDefinition & TooltipStoreInterface = {
  tooltips: [],

  useGlobalPortal: false,

  /**
   * Called via window.__openAllTooltips in selenium tests to check tooltip snapshots
   */
  openAllTooltips() {
    if (!this.tooltips.length) {
      return false;
    }
    this.tooltips.forEach(tooltip => {
      tooltip.setState({
        usesGlobalPortal: false,
      });
      tooltip.setOpen();
    });
    return true;
  },

  init(): void {
    window.__openAllTooltips = this.openAllTooltips.bind(this);
  },

  addTooltip(tooltip: Tooltip) {
    this.tooltips.push(tooltip);
  },

  removeTooltip(tooltip: Tooltip) {
    this.tooltips = this.tooltips.filter(t => t !== tooltip);
  },
};

type TooltipStore = Reflux.Store & TooltipStoreInterface;

export default Reflux.createStore(tooltipStore) as TooltipStore;
