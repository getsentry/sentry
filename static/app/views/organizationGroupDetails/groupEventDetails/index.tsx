import {useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchOrganizationEnvironments} from 'sentry/actionCreators/environments';
import {Client} from 'sentry/api';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import OrganizationEnvironmentsStore from 'sentry/stores/organizationEnvironmentsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Environment, Group, Organization, PageFilters, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {ReprocessingStatus} from '../utils';

import GroupEventDetails from './groupEventDetails';

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; orgId: string; eventId?: string}, {}> {
  api: Client;
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

export function GroupEventDetailsContainer(props: GroupEventDetailsProps) {
  const state = useLegacyStore(OrganizationEnvironmentsStore);

  useEffect(() => {
    if (!state.environments && !state.error) {
      fetchOrganizationEnvironments(props.api, props.organization.slug);
    }
    // XXX: Missing dependencies, but it reflects the old of componentDidMount
  }, []);

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

  return <GroupEventDetails {...otherProps} environments={environments} />;
}

export default withApi(withOrganization(withPageFilters(GroupEventDetailsContainer)));
