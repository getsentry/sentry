import React from "react";
import EventList from "./projectDashboard/eventList";
import ProjectState from "../mixins/projectState";
import ProjectChart from "./projectDashboard/chart";

var ProjectDashboard = React.createClass({
  mixins: [
    ProjectState
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  componentWillMount() {
    this.props.setProjectNavSection('dashboard');
  },

  getTrendingEventsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var qs = "sort_by=priority";
    return "/projects/" + params.orgId + "/" + params.projectId + "/groups/?" + qs;
  },

  getNewEventsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var qs = "sort_by=new";
    return "/projects/" + params.orgId + "/" + params.projectId + "/groups/?" + qs;
  },

  render() {
    return (
      <div>
        <ProjectChart />
        <div className="row">
          <div className="col-md-6">
            <EventList
                title="Trending Events"
                endpoint={this.getTrendingEventsEndpoint()} />
          </div>
          <div className="col-md-6">
            <EventList
                title="New Events"
                endpoint={this.getNewEventsEndpoint()} />
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectDashboard;

