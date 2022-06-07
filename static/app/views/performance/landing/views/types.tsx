import {Location} from 'history';

import {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

export type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  noCellActions: boolean;
  organization: Organization;
  projects: Project[];
};
