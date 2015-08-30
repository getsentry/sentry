import React from "react";
import api from "../../api";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import RouteMixin from "../../mixins/routeMixin";

import EventNode from "./eventNode";

var EventList = React.createClass({
  mixins: [
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    title: React.PropTypes.string.isRequired,
    endpoint: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      groupList: [],
      loading: true,
      error: false,
      statsPeriod: "24h"
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (nextParams.teamId != params.teamId) {
      this.fetchData();
    }
  },

  componentDidUpdate(_, prevState) {
    if (this.state.statsPeriod != prevState.statsPeriod) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    var minutes;
    switch(this.state.statsPeriod) {
      case "15m":
        minutes = "15";
        break;
      case "60m":
        minutes = "60";
        break;
      case "24h":
      default:
        minutes = "1440";
        break;
    }

    api.request(this.props.endpoint, {
      query: {
        limit: 5,
        minutes: minutes
      },
      success: (data) => {
        this.setState({
          groupList: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onSelectStatsPeriod(period) {
    this.setState({
      statsPeriod: period
    });
  },

  render() {
    var eventNodes = this.state.groupList.map((item) => {
      return <EventNode group={item} key={item.id} />;
    });

    return (
      <div className="box dashboard-widget">
        <div className="box-header clearfix">
          <div className="row">
            <div className="col-xs-8">
              <h3>{this.props.title}</h3>
            </div>
            <div className="col-xs-2 align-right">Events</div>
            <div className="col-xs-2 align-right">Users</div>
          </div>
        </div>
        <div className="box-content">
          <div className="tab-pane active">
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            : (eventNodes.length ?
              <ul className="group-list group-list-small">
                {eventNodes}
              </ul>
            :
              <div className="group-list-empty">No data available.</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
});

export default EventList;
