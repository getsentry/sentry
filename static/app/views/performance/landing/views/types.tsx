import {Location} from 'history';

import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

export interface BasePerformanceViewProps {
  eventView: EventView;
  location: Location;
  projects: Project[];
  organization: Organization;
}
