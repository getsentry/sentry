import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {browserHistory} from 'react-router';
import DocumentTitle from 'react-document-title';

import ApiMixin from 'app/mixins/apiMixin';
import GroupHeader from 'app/views/groupDetails/header';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';
import withEnvironment from 'app/utils/withEnvironment';

let ERROR_TYPES = {
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
};

const GroupDetails = createReactClass({
  displayName: 'GroupDetails',

  propTypes: {
    setProjectNavSection: PropTypes.func,
    memberList: PropTypes.array,
    environment: SentryTypes.Environment,
  },

  childContextTypes: {
    group: SentryTypes.Group,
    location: PropTypes.object,
  },

  mixins: [ApiMixin, Reflux.listenTo(GroupStore, 'onGroupChange')],

  getDefaultProps() {
    return {
      memberList: [],
    };
  },

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false,
      errorType: null,
    };
  },

  getChildContext() {
    return {
      group: this.state.group,
      location: this.props.location,
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
    if (
      prevProps.params.groupId !== this.props.params.groupId ||
      prevProps.environment !== this.props.environment
    ) {
      this.fetchData();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState());
  },

  fetchData() {
    const query = {};

    if (this.props.environment) {
      query.environment = this.props.environment.name;
    }

    this.api.request(this.getGroupDetailsEndpoint(), {
      query,
      success: data => {
        // TODO: Ideally, this would rebuild the route before parameter
        // interpolation, replace the `groupId` field of `this.routeParams`,
        // and use `formatPattern` from `react-router` to rebuild the URL,
        // rather than blindly pattern matching like we do here. Unfortunately,
        // `formatPattern` isn't actually exported until `react-router` 2.0.1:
        // https://github.com/reactjs/react-router/blob/v2.0.1/modules/index.js#L25
        if (this.props.params.groupId != data.id) {
          let location = this.props.location;
          return void browserHistory.push(
            location.pathname.replace(
              `/issues/${this.props.params.groupId}/`,
              `/issues/${data.id}/`
            ) +
              location.search +
              location.hash
          );
        }

        this.setState({
          loading: false,
          error: false,
          errorType: null,
        });

        return void GroupStore.loadInitialData([data]);
      },
      error: (_, textStatus, errorThrown) => {
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
          errorType,
        });
      },
    });
  },

  onGroupChange(itemIds) {
    let id = this.props.params.groupId;
    if (itemIds.has(id)) {
      let group = GroupStore.get(id);
      if (group) {
        if (group.stale) {
          this.fetchData();
          return;
        }
        this.setState({
          group,
        });
      }
    }
  },

  getGroupDetailsEndpoint() {
    let id = this.props.params.groupId;

    return '/issues/' + id + '/';
  },

  getTitle() {
    let group = this.state.group;

    if (!group) return 'Sentry';

    switch (group.type) {
      case 'error':
        if (group.metadata.type && group.metadata.value)
          return `${group.metadata.type}: ${group.metadata.value}`;
        return group.metadata.type || group.metadata.value;
      case 'csp':
        return group.metadata.message;
      case 'expectct':
      case 'expectstaple':
      case 'hpkp':
        return group.metadata.message;
      case 'default':
        return group.metadata.title;
      default:
        return group.message.split('\n')[0];
    }
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
    } else if (this.state.loading || !group) return <LoadingIndicator />;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className={this.props.className}>
          <GroupHeader
            orgId={params.orgId}
            projectId={params.projectId}
            group={group}
            memberList={this.props.memberList}
          />
          {React.cloneElement(this.props.children, {
            memberList: this.props.memberList,
            group,
          })}
        </div>
      </DocumentTitle>
    );
  },
});

export default withEnvironment(GroupDetails);
