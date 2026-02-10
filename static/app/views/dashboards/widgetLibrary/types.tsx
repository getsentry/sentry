import type {Widget} from 'sentry/views/dashboards/types';

export type WidgetTemplate = Widget & {
  isCustomizable: boolean;
};
