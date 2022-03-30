import {Component} from 'react';
import {RouteComponentProps} from 'react-router';

import {fetchOrganizationEnvironments} from 'sentry/actionCreators/environments';
import {Client} from 'sentry/api';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import OrganizationEnvironmentsStore from 'sentry/stores/organizationEnvironmentsStore';
import {Environment, Group, Organization, PageFilters, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {ReprocessingStatus} from '../utils';

import GroupEventDetails from './groupEventDetails';

type Props = RouteComponentProps<
  {groupId: string; orgId: string; eventId?: string},
  {}
> & {
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
};

type State = typeof OrganizationEnvironmentsStore['state'];

export class GroupEventDetailsContainer extends Component<Props, State> {
  state = OrganizationEnvironmentsStore.get();

  componentDidMount() {
    this.environmentUnsubscribe = OrganizationEnvironmentsStore.listen(
      data => this.setState(data),
      undefined
    );
    const {environments, error} = OrganizationEnvironmentsStore.get();
    if (!environments && !error) {
      fetchOrganizationEnvironments(this.props.api, this.props.organization.slug);
    }
  }

  componentWillUnmount() {
    if (this.environmentUnsubscribe) {
      this.environmentUnsubscribe();
    }
  }

  // TODO(ts): reflux :(
  environmentUnsubscribe: any;

  render() {
    if (this.state.error) {
      return (
        <LoadingError
          message={t("There was an error loading your organization's environments")}
        />
      );
    }
    // null implies loading state
    if (!this.state.environments) {
      return <LoadingIndicator />;
    }

    const {selection, ...otherProps} = this.props;
    const environments: Environment[] = this.state.environments.filter(env =>
      selection.environments.includes(env.name)
    );

    return <GroupEventDetails {...otherProps} environments={environments} />;
  }
}

export default withApi(withOrganization(withPageFilters(GroupEventDetailsContainer)));
