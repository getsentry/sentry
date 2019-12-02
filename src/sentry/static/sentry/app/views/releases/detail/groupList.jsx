import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import qs from 'query-string';

import {Panel, PanelBody} from 'app/components/panels';
import {fetchOrgMembers, indexMembersByProject} from 'app/actionCreators/members';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import StreamGroup from 'app/components/stream/group';
import StreamManager from 'app/utils/streamManager';
import withApi from 'app/utils/withApi';

import GroupListHeader from './groupListHeader';

const GroupList = createReactClass({
  displayName: 'GroupList',

  propTypes: {
    api: PropTypes.object.isRequired,
    query: PropTypes.string.isRequired,
    canSelectGroups: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange')],

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
    this._streamManager = new StreamManager(GroupStore);

    this.fetchData();
  },

  shouldComponentUpdate(_nextProps, nextState) {
    return !isEqual(this.state, nextState);
  },

  componentDidUpdate(prevProps) {
    if (prevProps.orgId !== this.props.orgId) {
      this.fetchData();
    }
  },

  componentWillUnmount() {
    GroupStore.loadInitialData([]);
  },

  fetchData() {
    GroupStore.loadInitialData([]);
    const {api, orgId} = this.props;

    this.setState({
      loading: true,
      error: false,
    });

    fetchOrgMembers(api, orgId).then(members => {
      this.setState({memberList: indexMembersByProject(members)});
    });

    api.request(this.getGroupListEndpoint(), {
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
    const {orgId} = this.props;
    const path = `/organizations/${orgId}/issues/`;

    return `${path}?${qs.stringify(this.getQueryParams())}`;
  },

  getQueryParams() {
    const {query} = this.props;

    const queryParams = this.context.location.query;
    queryParams.limit = 50;
    queryParams.sort = 'new';
    queryParams.query = query;

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
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    } else if (this.state.groups.length === 0) {
      return (
        <Panel>
          <PanelBody>
            <EmptyStateWarning>
              <p>{t("There don't seem to be any events fitting the query.")}</p>
            </EmptyStateWarning>
          </PanelBody>
        </Panel>
      );
    }

    const {orgId} = this.props;

    return (
      <Panel>
        <GroupListHeader />
        <PanelBody>
          {this.state.groups.map(({id, project}) => {
            const members =
              this.state.memberList && this.state.memberList.hasOwnProperty(project.slug)
                ? this.state.memberList[project.slug]
                : null;

            return (
              <StreamGroup
                key={id}
                id={id}
                orgId={orgId}
                canSelect={this.props.canSelectGroups}
                memberList={members}
              />
            );
          })}
        </PanelBody>
      </Panel>
    );
  },
});

export {GroupList};

export default withApi(GroupList);
