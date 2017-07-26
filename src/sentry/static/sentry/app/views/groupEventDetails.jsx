import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import EventEntries from '../components/events/eventEntries';
import GroupEventToolbar from './groupDetails/eventToolbar';
import GroupSidebar from '../components/group/sidebar';
import GroupState from '../mixins/groupState';
import MutedBox from '../components/mutedBox';
import GroupEventDetailsLoadingError
  from '../components/errors/groupEventDetailsLoadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ResolutionBox from '../components/resolutionBox';

const GroupEventDetails = React.createClass({
  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      event: null,
      eventNavLinks: ''
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

    let url = eventId === 'latest' || eventId === 'oldest'
      ? '/issues/' + this.getGroup().id + '/events/' + eventId + '/'
      : '/events/' + eventId + '/';

    this.setState({
      loading: true,
      error: false
    });

    this.api.request(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          event: data,
          error: false,
          loading: false
        });

        this.api.bulkUpdate({
          orgId: this.getOrganization().slug,
          projectId: this.getProject().slug,
          itemIds: [this.getGroup().id],
          failSilently: true,
          data: {hasSeen: true}
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    let group = this.getGroup();
    let evt = this.state.event;
    let params = this.props.params;

    return (
      <div>
        <div className="event-details-container">
          <div className="primary">
            {evt &&
              <GroupEventToolbar
                group={group}
                event={evt}
                orgId={params.orgId}
                projectId={params.projectId}
              />}
            {group.status != 'unresolved' &&
              <div className="issue-status">
                {group.status === 'ignored' &&
                  <MutedBox statusDetails={group.statusDetails} />}
                {group.status === 'resolved' &&
                  <ResolutionBox statusDetails={group.statusDetails} params={params} />}
              </div>}
            {this.state.loading
              ? <LoadingIndicator />
              : this.state.error
                  ? <GroupEventDetailsLoadingError onRetry={this.fetchData} />
                  : <EventEntries
                      group={group}
                      event={evt}
                      orgId={params.orgId}
                      project={this.getProject()}
                    />}
          </div>
          <div className="secondary">
            <GroupSidebar group={group} event={evt} />
          </div>
        </div>
      </div>
    );
  }
});

export default GroupEventDetails;
