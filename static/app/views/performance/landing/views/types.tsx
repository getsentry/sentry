import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type EventView from 'sentry/utils/discover/eventView';

export type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  withStaticFilters: boolean;
};
