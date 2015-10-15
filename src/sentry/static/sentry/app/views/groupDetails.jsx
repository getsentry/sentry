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

const ERROR_TYPES = {
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND"
};

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
      error: false,
      errorType: null
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false,
          error: false,
          errorType: null
        });

        GroupStore.loadInitialData([data]);
      }, error: (_, textStatus, errorThrown) => {
        let errorType = null;
        switch (errorThrown) {
          case "NOT FOUND":
            errorType = ERROR_TYPES.GROUP_NOT_FOUND;
            break;
          default:
        }
        this.setState({
          loading: false,
          error: true,
          errorType: errorType
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

    if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.GROUP_NOT_FOUND:
          return (
            <div className="alert alert-block">The issue you were looking for was not found.</div>
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    } else if (this.state.loading || !group)
      return <LoadingIndicator />;

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
