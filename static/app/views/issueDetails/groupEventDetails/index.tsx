import {RouteComponentProps} from 'react-router';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import OrganizationEnvironmentsStore from 'sentry/stores/organizationEnvironmentsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Environment, Group, Organization, PageFilters, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

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
  selection: PageFilters;
}

// Blocks rendering of the event until the environment is loaded
export function GroupEventDetailsContainer(props: GroupEventDetailsProps) {
  const api = useApi();

  // fetchOrganizationEnvironments is called in groupDetails.tsx
  const state = useLegacyStore(OrganizationEnvironmentsStore);

  if (state.error) {
    return (
      <LoadingError
        message={t("There was an error loading your organization's environments")}
      />
    );
  }
  // null implies loading state
  if (!state.environments) {
    return <LoadingIndicator />;
  }

  const {selection, ...otherProps} = props;
  const environments: Environment[] = state.environments.filter(env =>
    selection.environments.includes(env.name)
  );

  return <GroupEventDetails {...otherProps} api={api} environments={environments} />;
}

export default withOrganization(withPageFilters(GroupEventDetailsContainer));
