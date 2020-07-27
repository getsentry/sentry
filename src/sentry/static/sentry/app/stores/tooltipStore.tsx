import Reflux from 'reflux';

import Tooltip from 'app/components/tooltip';

type TooltipStoreInterface = {
  addTooltip: (tooltip: Tooltip) => void;
  removeTooltip: (tooltip: Tooltip) => void;
  openAllTooltips: () => void;
  tooltips: Tooltip[];
};

const tooltipStore: Reflux.StoreDefinition & TooltipStoreInterface = {
  tooltips: [],

  useGlobalPortal: false,

  openAllTooltips() {
    this.tooltips.forEach(tooltip => {
      tooltip.setState({
        usesGlobalPortal: false,
      });
      tooltip.setOpen();
    });
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
