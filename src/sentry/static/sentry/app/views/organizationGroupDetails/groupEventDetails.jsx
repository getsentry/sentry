import React from 'react';
import PropTypes from 'prop-types';
import {isEqual} from 'lodash';
import {browserHistory} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import {withMeta} from 'app/components/events/meta/metaProxy';
import EventEntries from 'app/components/events/eventEntries';
import GroupEventDetailsLoadingError from 'app/components/errors/groupEventDetailsLoadingError';
import GroupSidebar from 'app/components/group/sidebar';
import LoadingIndicator from 'app/components/loadingIndicator';
import ResolutionBox from 'app/components/resolutionBox';
import MutedBox from 'app/components/mutedBox';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import fetchSentryAppInstallations from 'app/utils/fetchSentryAppInstallations';
import {fetchSentryAppComponents} from 'app/actionCreators/sentryAppComponents';
import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';

import GroupEventToolbar from './eventToolbar';
import {fetchGroupEventAndMarkSeen, getEventEnvironment} from './utils';

class GroupEventDetails extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
    environments: PropTypes.arrayOf(SentryTypes.Environment).isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      event: null,
      eventNavLinks: '',
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps, prevState) {
    const {environments, params, location} = this.props;

    const eventHasChanged = prevProps.params.eventId !== params.eventId;
    const environmentsHaveChanged = !isEqual(prevProps.environments, environments);

    // If environments are being actively changed and will no longer contain the
    // current event's environment, redirect to latest
    if (
      environmentsHaveChanged &&
      prevState.event &&
      params.eventId &&
      !['latest', 'oldest'].includes(params.eventId)
    ) {
      const shouldRedirect =
        environments.length > 0 &&
        !environments.find(env => env.name === getEventEnvironment(prevState.event));

      if (shouldRedirect) {
        browserHistory.replace({
          pathname: `/organizations/${params.orgId}/issues/${params.groupId}/`,
          query: location.query,
        });
        return;
      }
    }

    if (eventHasChanged || environmentsHaveChanged) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.props.api.clear();
  }

  fetchData = () => {
    const {api, group, project, organization, params, environments} = this.props;
    const eventId = params.eventId || 'latest';
    const groupId = group.id;
    const orgSlug = organization.slug;
    const projSlug = project.slug;
    const projectId = project.id;

    this.setState({
      loading: true,
      error: false,
    });

    const envNames = environments.map(e => e.name);

    fetchGroupEventAndMarkSeen(api, orgSlug, projSlug, groupId, eventId, envNames)
      .then(data => {
        this.setState({
          event: data,
          error: false,
          loading: false,
        });
      })
      .catch(() => {
        this.setState({
          event: null,
          error: true,
          loading: false,
        });
      });

    fetchSentryAppInstallations(api, orgSlug);
    fetchSentryAppComponents(api, orgSlug, projectId);
  };

  render() {
    const {group, project, organization, environments, location} = this.props;
    const evt = withMeta(this.state.event);

    return (
      <div>
        <div className="event-details-container">
          <div className="primary">
            {evt && (
              <GroupEventToolbar
                organization={organization}
                group={group}
                event={evt}
                orgId={organization.slug}
                projectId={project.slug}
                location={location}
              />
            )}
            {group.status !== 'unresolved' && (
              <div className="issue-status">
                {group.status === 'ignored' && (
                  <MutedBox statusDetails={group.statusDetails} />
                )}
                {group.status === 'resolved' && (
                  <ResolutionBox
                    statusDetails={group.statusDetails}
                    orgId={organization.slug}
                    projectId={project.slug}
                  />
                )}
              </div>
            )}
            {this.state.loading ? (
              <LoadingIndicator />
            ) : this.state.error ? (
              <GroupEventDetailsLoadingError
                environments={environments}
                onRetry={this.fetchData}
              />
            ) : (
              <EventEntries
                group={group}
                event={evt}
                orgId={organization.slug}
                project={project}
              />
            )}
          </div>
          <div className="secondary">
            <GroupSidebar
              organization={organization}
              project={project}
              group={group}
              event={evt}
              environments={environments}
            />
          </div>
        </div>
      </div>
    );
  }
}

export {GroupEventDetails};

export default withApi(
  withOrganization(
    withGlobalSelection(props => {
      const {selection, ...otherProps} = props;
      const environments = OrganizationEnvironmentsStore.getActive().filter(env =>
        selection.environments.includes(env.name)
      );

      return <GroupEventDetails {...otherProps} environments={environments} />;
    })
  )
);
