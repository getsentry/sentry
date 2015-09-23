import React from "react";
import api from "../api";
import ApiMixin from "../mixins/apiMixin";
import EventEntries from "../components/events/eventEntries";
import GroupEventToolbar from "./groupDetails/eventToolbar";
import GroupSidebar from "../components/group/sidebar";
import GroupState from "../mixins/groupState";
import MutedBox from "../components/mutedBox";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";


var GroupEventDetails = React.createClass({
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
    var eventId = this.props.params.eventId || 'latest';

    var url = (eventId === 'latest' || eventId === 'oldest' ?
      '/groups/' + this.getGroup().id + '/events/' + eventId + '/' :
      '/events/' + eventId + '/');

    this.setState({
      loading: true,
      error: false
    });

    this.apiRequest(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          event: data,
          error: false,
          loading: false
        });

        api.bulkUpdate({
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
    var group = this.getGroup();
    var evt = this.state.event;
    var params = this.props.params;

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
            <MutedBox status={group.status} />
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            :
              <EventEntries
                group={group}
                event={evt}
                orgId={params.orgId}
                projectId={params.projectId} />
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
