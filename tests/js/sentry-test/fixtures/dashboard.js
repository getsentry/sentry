import {Widget} from './widget';

const DEFAULT_WIDGETS = [Widget()];

export function Dashboard(widgets = DEFAULT_WIDGETS) {
  return {
    widgets,
    title: 'Dashboard',
  };
}
