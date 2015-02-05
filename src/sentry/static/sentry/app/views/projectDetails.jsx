/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var MemberListStore = require("../stores/memberListStore");

var ProjectDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.connect(MemberListStore, "memberList"),
    Router.Navigation,
    Router.State
  ],

  getInitialState(){
    return {
      memberList: [],
      project: null
    };
  },

  componentWillMount() {
    api.request(this.getMemberListEndpoint(), {
      success: (data) => {
        MemberListStore.loadInitialData(data);
      }
    });

    api.request(this.getProjectDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          project: data
        });

        this.setBreadcrumbs([
          <a onClick={this.transitionTo.bind(this, "projectDetails", this.getParams(), {})}>
            {data.name}
          </a>
        ]);
      }
    });
  },

  getProjectDetailsEndpoint() {
    var params = this.getParams();
    return '/projects/' + params.orgId + '/' + params.projectId + '/';
  },

  getMemberListEndpoint() {
    var params = this.getParams();
    return '/projects/' + params.orgId + '/' + params.projectId + '/members/';
  },

  render() {
    return (
      <Router.RouteHandler memberList={this.state.memberList} />
    );
  }
});

module.exports = ProjectDetails;
