import React from 'react';
import createReactClass from 'create-react-class';

import {decorateEvent} from 'app/components/events/meta/metaProxy';
import ApiMixin from 'app/mixins/apiMixin';
import EventEntries from 'app/components/events/eventEntries';
import GroupEventDetailsLoadingError from 'app/components/errors/groupEventDetailsLoadingError';
import GroupEventToolbar from 'app/views/groupDetails/eventToolbar';
import GroupSidebar from 'app/components/group/sidebar';
import GroupState from 'app/mixins/groupState';
import LoadingIndicator from 'app/components/loadingIndicator';
import MutedBox from 'app/components/mutedBox';
import ResolutionBox from 'app/components/resolutionBox';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

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
    let evt = decorateEvent(this.state.event);
    let params = this.props.params;

    return (
      <div>
        <div className="event-details-container">
          <div className="primary">
            {evt && (
              <GroupEventToolbar
                group={group}
                event={evt}
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
              <EventEntries
                group={group}
                event={evt}
                orgId={params.orgId}
                project={this.getProject()}
              />
            )}
          </div>
          <div className="secondary">
            <GroupSidebar group={group} event={evt} />
          </div>
        </div>
      </div>
    );
  },
});

export default withEnvironmentInQueryString(GroupEventDetails);
