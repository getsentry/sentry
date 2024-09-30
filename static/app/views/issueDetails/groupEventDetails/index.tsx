import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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
