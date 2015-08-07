import React from "react";
import Reflux from "reflux";
import Router from "react-router";
import api from "../api";
import DocumentTitle from "react-document-title";
import GroupHeader from "./groupDetails/header";
import GroupStore from "../stores/groupStore";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import PropTypes from "../proptypes";
import utils from "../utils";

var GroupDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange")
  ],

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  childContextTypes: {
    group: PropTypes.Group,
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');
    this.fetchData();
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false
        });

        GroupStore.loadInitialData([data]);
      }, error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onGroupChange(itemIds) {
    var id = this.context.router.getCurrentParams().groupId;
    if (itemIds.has(id)) {
      this.setState({
        group: GroupStore.get(id),
      });
    }
  },

  getGroupDetailsEndpoint() {
    var id = this.context.router.getCurrentParams().groupId;

    return '/groups/' + id + '/';
  },

  getTitle() {
    if (this.state.group)
      return this.state.group.title;
    return 'Sentry';
  },

  render() {
    var group = this.state.group;
    var params = this.context.router.getCurrentParams();

    if (this.state.loading || !group)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className={this.props.className}>
          <GroupHeader
              orgId={params.orgId}
              projectId={params.projectId}
              group={group}
              memberList={this.props.memberList} />
          <Router.RouteHandler
              memberList={this.props.memberList}
              group={group} />
        </div>
      </DocumentTitle>
    );
  }
});

export default GroupDetails;

