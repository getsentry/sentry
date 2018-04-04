import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import jQuery from 'jquery';

import SentryTypes from '../proptypes';
import ApiMixin from '../mixins/apiMixin';
import GroupListHeader from './groupListHeader';
import GroupStore from '../stores/groupStore';
import LoadingError from './loadingError';
import LoadingIndicator from './loadingIndicator';
import ProjectState from '../mixins/projectState';
import StreamGroup from './stream/group';
import utils from '../utils';
import {t} from '../locale';
import {Panel, PanelBody} from './panels';
import EmptyStateWarning from '../components/emptyStateWarning';

const GroupList = createReactClass({
  displayName: 'GroupList',

  propTypes: {
    query: PropTypes.string.isRequired,
    canSelectGroups: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    bulkActions: PropTypes.bool.isRequired,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [ProjectState, Reflux.listenTo(GroupStore, 'onGroupChange'), ApiMixin],

  getDefaultProps() {
    return {
      canSelectGroups: true,
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      groupIds: [],
    };
  },

  componentWillMount() {
    this._streamManager = new utils.StreamManager(GroupStore);

    this.fetchData();
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !utils.valueIsEqual(this.state, nextState, true);
  },

  componentDidUpdate(prevProps) {
    if (
      prevProps.orgId !== this.props.orgId ||
      prevProps.projectId !== this.props.projectId
    ) {
      this.fetchData();
    }
  },

  componentWillUnmount() {
    GroupStore.loadInitialData([]);
  },

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(this.getGroupListEndpoint(), {
      success: (data, _, jqXHR) => {
        this._streamManager.push(data);

        this.setState({
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getGroupListEndpoint() {
    let queryParams = this.context.location.query;
    queryParams.limit = 50;
    queryParams.sort = 'new';
    queryParams.query = this.props.query;

    if (this.props.environment) {
      queryParams.environment = this.props.environment.name;
    } else {
      delete queryParams.environment;
    }

    let querystring = jQuery.param(queryParams);

    let props = this.props;
    return '/projects/' + props.orgId + '/' + props.projectId + '/issues/?' + querystring;
  },

  onGroupChange() {
    let groupIds = this._streamManager.getAllItems().map(item => item.id);
    if (!utils.valueIsEqual(groupIds, this.state.groupIds)) {
      this.setState({
        groupIds,
      });
    }
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.groupIds.length === 0)
      return (
        <Panel>
          <PanelBody>
            <EmptyStateWarning>
              {t("There doesn't seem to be any events fitting the query.")}
            </EmptyStateWarning>
          </PanelBody>
        </Panel>
      );

    let wrapperClass;

    if (!this.props.bulkActions) {
      wrapperClass = 'stream-no-bulk-actions';
    }

    let {orgId, projectId} = this.props;

    return (
      <div className={wrapperClass}>
        <GroupListHeader />
        <ul className="group-list">
          {this.state.groupIds.map(id => {
            return (
              <StreamGroup
                key={id}
                id={id}
                orgId={orgId}
                projectId={projectId}
                canSelect={this.props.canSelectGroups}
              />
            );
          })}
        </ul>
      </div>
    );
  },
});

export default GroupList;
