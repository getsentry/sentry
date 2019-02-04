import React from 'react';

import SentryTypes from 'app/sentryTypes';
import {withMeta} from 'app/components/events/meta/metaProxy';
import EventEntries from 'app/components/events/eventEntries';
import GroupEventDetailsLoadingError from 'app/components/errors/groupEventDetailsLoadingError';
import GroupSidebar from 'app/components/group/sidebar';
import LoadingIndicator from 'app/components/loadingIndicator';
import ResolutionBox from 'app/components/resolutionBox';
import MutedBox from 'app/components/mutedBox';
import withOrganization from 'app/utils/withOrganization';
import withEnvironment from 'app/utils/withEnvironment';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import OrganizationEnvironmentStore from 'app/stores/organizationEnvironmentsStore';

import GroupEventToolbar from './eventToolbar';
import {fetchGroupEventAndMarkSeen} from './utils';

const GroupSidebarWithLatestContextEnvironment = withEnvironment(props => {
  const {environment, ...otherProps} = props;
  return <GroupSidebar {...otherProps} environments={environment ? [environment] : []} />;
});

const GroupSidebarWithGlobalSelectionEnvironment = withGlobalSelection(props => {
  const {selection, ...otherProps} = props;
  const environments = OrganizationEnvironmentStore.getActive().filter(env =>
    selection.environments.includes(env.name)
  );

  return <GroupSidebar {...otherProps} environments={environments} />;
});

class GroupEventDetails extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
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

  componentDidUpdate(prevProps) {
    if (prevProps.params.eventId !== this.props.params.eventId) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {group, project, organization, params} = this.props;
    const eventId = params.eventId || 'latest';
    const groupId = group.id;
    const orgSlug = organization.slug;
    const projSlug = project.slug;

    this.setState({
      loading: true,
      error: false,
    });

    fetchGroupEventAndMarkSeen(orgSlug, projSlug, groupId, eventId)
      .then(data => {
        this.setState({
          event: data,
          error: false,
          loading: false,
        });
      })
      .catch(() => {
        this.setState({
          error: true,
          loading: false,
        });
      });
  };
  render() {
    const {group, project, organization, params} = this.props;
    const evt = withMeta(this.state.event);

    const SidebarWithEnvironment = params.projectId
      ? GroupSidebarWithLatestContextEnvironment
      : GroupSidebarWithGlobalSelectionEnvironment;

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
              />
            )}
            {group.status != 'unresolved' && (
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
              <GroupEventDetailsLoadingError onRetry={this.fetchData} />
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
            <SidebarWithEnvironment project={project} group={group} event={evt} />
          </div>
        </div>
      </div>
    );
  }
}

export default withOrganization(GroupEventDetails);
