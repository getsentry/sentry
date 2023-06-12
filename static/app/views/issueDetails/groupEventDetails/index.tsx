import {RouteComponentProps} from 'react-router';

import {Group, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import {ReprocessingStatus} from '../utils';

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
  const api = useApi();

  return <GroupEventDetails {...props} api={api} />;
}

export default withOrganization(GroupEventDetailsContainer);
