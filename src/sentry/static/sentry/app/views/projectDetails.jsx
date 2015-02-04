/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbStore = require("../stores/breadcrumbStore");
var MemberListStore = require("../stores/memberListStore");

var ProjectDetails = React.createClass({
  mixins: [Reflux.connect(MemberListStore, "memberList"), Router.State],

  getInitialState: function(){
    return {
      memberList: []
    };
  },

  componentWillMount: function() {
    api.request(this.getMemberListEndpoint(), {
      success: function(data, textStatus, jqXHR) {
        MemberListStore.loadInitialData(data);
      }.bind(this)
    });

    BreadcrumbStore.push(
      <a href="#">Foobar</a>
    );
  },

  componentWillUnmount: function() {
    BreadcrumbStore.pop();
  },

  getMemberListEndpoint: function() {
    var params = this.getParams();
    return '/projects/' + params.orgId + '/' + params.projectId + '/members/';
  },

  render: function () {
    return (
      <Router.RouteHandler memberList={this.state.memberList} />
    );
  }
});

module.exports = ProjectDetails;
