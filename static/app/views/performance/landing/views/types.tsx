import type {Location} from 'history';

import type {Organization, Project} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';

export type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  withStaticFilters: boolean;
};
