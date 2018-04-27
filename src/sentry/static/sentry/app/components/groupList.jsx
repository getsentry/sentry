import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import jQuery from 'jquery';

import SentryTypes from 'app/proptypes';
import ApiMixin from 'app/mixins/apiMixin';
import GroupListHeader from 'app/components/groupListHeader';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectState from 'app/mixins/projectState';
import StreamGroup from 'app/components/stream/group';
import utils from 'app/utils';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel, PanelBody} from 'app/components/panels';

const GroupList = createReactClass({
  displayName: 'GroupList',

  propTypes: {
    query: PropTypes.string.isRequired,
    canSelectGroups: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
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

    let {orgId, projectId} = this.props;

    return (
      <Panel>
        <GroupListHeader />
        <PanelBody>
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
        </PanelBody>
      </Panel>
    );
  },
});

export default GroupList;
