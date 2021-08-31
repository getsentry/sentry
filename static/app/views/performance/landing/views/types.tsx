import {Location} from 'history';

import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';

export type BasePerformanceViewProps = {
  eventView: EventView;
  location: Location;
  projects: Project[];
  organization: Organization;
};
