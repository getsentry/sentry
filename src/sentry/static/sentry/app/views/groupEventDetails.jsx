import React from 'react';
import createReactClass from 'create-react-class';

import ApiMixin from 'app/mixins/apiMixin';
import EventEntries from 'app/components/events/eventEntries';
import GroupEventToolbar from 'app/views/groupDetails/eventToolbar';
import GroupSidebar from 'app/components/group/sidebar';
import GroupState from 'app/mixins/groupState';
import MutedBox from 'app/components/mutedBox';
import GroupEventDetailsLoadingError from 'app/components/errors/groupEventDetailsLoadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ResolutionBox from 'app/components/resolutionBox';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import DataGroup from 'app/components/events/meta/dataGroup';

const GroupEventDetails = createReactClass({
  displayName: 'GroupEventDetails',

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      event: null,
      eventNavLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (prevProps.params.eventId !== this.props.params.eventId) {
      this.fetchData();
    }
  },

  fetchData() {
    let eventId = this.props.params.eventId || 'latest';

    let url =
      eventId === 'latest' || eventId === 'oldest'
        ? '/issues/' + this.getGroup().id + '/events/' + eventId + '/'
        : '/events/' + eventId + '/';

    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          event: data,
          error: false,
          loading: false,
        });

        this.api.bulkUpdate({
          orgId: this.getOrganization().slug,
          projectId: this.getProject().slug,
          itemIds: [this.getGroup().id],
          failSilently: true,
          data: {hasSeen: true},
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  render() {
    let group = this.getGroup();
    let {_meta, ...event} = this.state.event || {};
    let params = this.props.params;

    return (
      <div>
        <div className="event-details-container">
          <div className="primary">
            {this.state.event && (
              <GroupEventToolbar
                group={group}
                event={event}
                orgId={params.orgId}
                projectId={params.projectId}
              />
            )}
            {group.status != 'unresolved' && (
              <div className="issue-status">
                {group.status === 'ignored' && (
                  <MutedBox statusDetails={group.statusDetails} />
                )}
                {group.status === 'resolved' && (
                  <ResolutionBox statusDetails={group.statusDetails} params={params} />
                )}
              </div>
            )}
            {this.state.loading ? (
              <LoadingIndicator />
            ) : this.state.error ? (
              <GroupEventDetailsLoadingError onRetry={this.fetchData} />
            ) : (
              <DataGroup data={event} meta={_meta}>
                <EventEntries
                  group={group}
                  event={event}
                  orgId={params.orgId}
                  project={this.getProject()}
                />
              </DataGroup>
            )}
          </div>
          <div className="secondary">
            <GroupSidebar group={group} event={event} />
          </div>
        </div>
      </div>
    );
  },
});

export default withEnvironmentInQueryString(GroupEventDetails);
