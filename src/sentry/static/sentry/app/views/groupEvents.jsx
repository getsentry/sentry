/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var GroupEventsPagination = require("./groupEvents/pagination");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var TimeSince = require("../components/timeSince");

var GroupEvents = React.createClass({
  mixins: [GroupState, Router.Navigation, Router.State],

  getInitialState() {
    return {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var queryParams = this.getQuery();
    var querystring = $.param(queryParams);

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/events/?' + querystring, {
      success: (data, _, jqXHR) => {
        this.setState({
          eventList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var children = this.state.eventList.map((event, eventIdx) => {
      var linkParams = {
        orgId: this.getOrganization().slug,
        projectId: this.getProject().slug,
        groupId: this.getGroup().id,
        eventId: event.id
      };

      return (
        <tr key={eventIdx}>
          <td>
            <Router.Link to="groupEventDetails"
                  params={linkParams}>{event.message}</Router.Link>
            <br />
            <small className="tagList">{event.tags.map((tag, tagIdx) => {
              return <span key={tagIdx}>{tag[0]} = {tag[1]}</span>;
            })}</small>
          </td>
          <td>
            <TimeSince date={event.dateCreated} />
          </td>
        </tr>
      );
    });

    return (
      <div>
        <table className="table">
          {children}
        </table>

        <GroupEventsPagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
});

module.exports = GroupEvents;
