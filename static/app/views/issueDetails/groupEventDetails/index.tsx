import type {RouteComponentProps} from 'react-router';

import type {Group, Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import withOrganization from 'sentry/utils/withOrganization';

import type {ReprocessingStatus} from '../utils';

import GroupEventDetails from './groupEventDetails';

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; eventId?: string}, {}> {
  event: Event;
  eventError: boolean;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  loadingEvent: boolean;
  onRetry: () => void;
  organization: Organization;
  project: Project;
}

export function GroupEventDetailsContainer(props: GroupEventDetailsProps) {
  return <GroupEventDetails {...props} />;
}

export default withOrganization(GroupEventDetailsContainer);
