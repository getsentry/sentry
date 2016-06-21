import React from 'react';
import Reflux from 'reflux';
import ApiMixin from '../mixins/apiMixin';
import DocumentTitle from 'react-document-title';
import GroupHeader from './groupDetails/header';
import GroupStore from '../stores/groupStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import PropTypes from '../proptypes';
import {t} from '../locale';
import {History} from 'react-router';

let ERROR_TYPES = {
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND'
};

const GroupDetails = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func,
    memberList: React.PropTypes.array
  },

  childContextTypes: {
    group: PropTypes.Group,
  },

  mixins: [
    ApiMixin,
    History,
    Reflux.listenTo(GroupStore, 'onGroupChange')
  ],

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false,
      errorType: null
    };
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId) {
      this.remountComponent();
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.params.groupId !== this.props.params.groupId) {
      this.fetchData();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState());
  },

  fetchData() {
    this.api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        // TODO: Ideally, this would rebuild the route before parameter
        // interpolation, replace the `groupId` field of `this.routeParams`,
        // and use `formatPattern` from `react-router` to rebuild the URL,
        // rather than blindly pattern matching like we do here. Unfortunately,
        // `formatPattern` isn't actually exported until `react-router` 2.0.1:
        // https://github.com/reactjs/react-router/blob/v2.0.1/modules/index.js#L25
        if (this.props.params.groupId != data.id) {
          let location = this.props.location;
          return void this.history.pushState(
            null,
            location.pathname.replace(
              `/issues/${this.props.params.groupId}/`,
              `/issues/${data.id}/`
            ) + location.search + location.hash
          );
        }

        this.setState({
          loading: false,
          error: false,
          errorType: null
        });

        GroupStore.loadInitialData([data]);
      }, error: (_, textStatus, errorThrown) => {
        let errorType = null;
        switch (errorThrown) {
          case 'NOT FOUND':
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
    let id = this.props.params.groupId;
    if (itemIds.has(id)) {
      this.setState({
        group: GroupStore.get(id),
      });
    }
  },

  getGroupDetailsEndpoint() {
    let id = this.props.params.groupId;

    return '/issues/' + id + '/';
  },

  getTitle() {
    if (this.state.group)
      return this.state.group.title;
    return 'Sentry';
  },

  render() {
    let group = this.state.group;
    let params = this.props.params;

    if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.GROUP_NOT_FOUND:
          return (
            <div className="alert alert-block">
              {t('The issue you were looking for was not found.')}
            </div>
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
          {React.cloneElement(this.props.children, {
              memberList: this.props.memberList,
              group: group
          })}
        </div>
      </DocumentTitle>
    );
  }
});

export default GroupDetails;
