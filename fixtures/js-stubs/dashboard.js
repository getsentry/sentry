const {Widget} = require('./widget');

const DEFAULT_WIDGETS = [Widget()];

module.exports.Dashboard = function (widgets = DEFAULT_WIDGETS, props = {}) {
  return {
    id: 1,
    title: 'Dashboard',
    createdBy: '',
    widgets,
    ...props,
  };
};
