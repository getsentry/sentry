import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {isEqual} from 'lodash';
import qs from 'query-string';

import SentryTypes from 'app/sentryTypes';
import ApiMixin from 'app/mixins/apiMixin';
import GroupListHeader from 'app/components/groupListHeader';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
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
    // Provided in the project version, not in org version
    projectId: PropTypes.string,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange'), ApiMixin],

  getDefaultProps() {
    return {
      canSelectGroups: true,
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      groups: [],
    };
  },

  componentWillMount() {
    this._streamManager = new utils.StreamManager(GroupStore);

    this.fetchData();
  },

  shouldComponentUpdate(_nextProps, nextState) {
    return !isEqual(this.state, nextState);
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
    const {orgId, projectId} = this.props;
    const path = projectId
      ? `/projects/${orgId}/${projectId}/issues/`
      : `/organizations/${orgId}/issues/`;

    return `${path}?${qs.stringify(this.getQueryParams())}`;
  },

  getQueryParams() {
    const {projectId, query, environment} = this.props;

    const queryParams = this.context.location.query;
    queryParams.limit = 50;
    queryParams.sort = 'new';
    queryParams.query = query;

    if (projectId) {
      if (environment) {
        queryParams.environment = environment.name;
      } else {
        delete queryParams.environment;
      }
    }

    return queryParams;
  },

  onGroupChange() {
    const groups = this._streamManager.getAllItems();

    if (!isEqual(groups, this.state.groups)) {
      this.setState({
        groups,
      });
    }
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.groups.length === 0)
      return (
        <Panel>
          <PanelBody>
            <EmptyStateWarning>
              {t("There doesn't seem to be any events fitting the query.")}
            </EmptyStateWarning>
          </PanelBody>
        </Panel>
      );

    let {orgId} = this.props;

    return (
      <Panel>
        <GroupListHeader />
        <PanelBody>
          {this.state.groups.map(({id, project}) => {
            return (
              <StreamGroup
                key={id}
                id={id}
                orgId={orgId}
                projectId={project.slug}
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
