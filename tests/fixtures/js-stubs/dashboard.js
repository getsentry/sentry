import {Widget} from './widget';

const DEFAULT_WIDGETS = [Widget()];

export function Dashboard(widgets = DEFAULT_WIDGETS, props = {}) {
  return {
    id: 1,
    title: 'Dashboard',
    createdBy: '',
    widgets,
    ...props,
  };
}
