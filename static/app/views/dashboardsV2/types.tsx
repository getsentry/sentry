import {Widget} from './widget/types';

/**
 * The response shape from dashboard list endpoint
 */
export type DashboardListItem = {
  id: string;
  title: string;
  dateCreated: string;
  createdBy: string;
};

/**
 * Saved dashboard with widgets
 */
export type DashboardDetails = {
  title: string;
  widgets: Widget[];
  id: string;
  dateCreated: string;
  createdBy: string;
};

export type DashboardState = 'view' | 'edit' | 'create' | 'pending_delete';
