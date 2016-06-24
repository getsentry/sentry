import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import EventEntries from '../components/events/eventEntries';
import GroupEventToolbar from './groupDetails/eventToolbar';
import GroupSidebar from '../components/group/sidebar';
import GroupState from '../mixins/groupState';
import MutedBox from '../components/mutedBox';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';


const GroupEventDetails = React.createClass({
  mixins: [
    ApiMixin,
    GroupState
  ],

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

    let url = (eventId === 'latest' || eventId === 'oldest' ?
      '/issues/' + this.getGroup().id + '/events/' + eventId + '/' :
      '/events/' + eventId + '/');

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
        <div className="row event">
          <div className="col-md-9">
            {evt &&
              <GroupEventToolbar
                  group={group}
                  event={evt}
                  orgId={params.orgId}
                  projectId={params.projectId} />
            }
            {group.status === 'muted' &&
              <MutedBox statusDetails={group.statusDetails} />
            }
            {group.status === 'resolved' && group.statusDetails.inNextRelease &&
              <div className="alert alert-info alert-block">
                <span>{t(`This issue has been marked as being resolved in the next
                  release. Until then, you will not get notified about new
                  occurrences.`)}</span>
              </div>
            }
            {group.status === 'resolved' && group.statusDetails.autoResolved &&
              <div className="alert alert-info alert-block">
                <span>{t(`This issue was automatically marked as resolved due to
                  the Auto Resolve configuration for this project.`)}</span>
              </div>
            }
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            :
              <EventEntries
                group={group}
                event={evt}
                orgId={params.orgId}
                project={this.getProject()} />
            )}
          </div>
          <div className="col-md-3">
            <GroupSidebar group={group} />
          </div>
        </div>
      </div>
    );
  }
});

export default GroupEventDetails;
