import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
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
import Pagination from 'app/components/pagination';

import GroupListHeader from './groupListHeader';

const GroupList = createReactClass({
  displayName: 'GroupList',

  propTypes: {
    api: PropTypes.object.isRequired,
    query: PropTypes.string.isRequired,
    canSelectGroups: PropTypes.bool,
    withChart: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    endpointPath: PropTypes.string,
  },

  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange')],

  getDefaultProps() {
    return {
      canSelectGroups: true,
      withChart: true,
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

  shouldComponentUpdate(nextProps, nextState) {
    return (
      !isEqual(this.state, nextState) ||
      nextProps.endpointPath !== this.props.endpointPath ||
      nextProps.query !== this.props.query
    );
  },

  componentDidUpdate(prevProps) {
    if (
      prevProps.orgId !== this.props.orgId ||
      prevProps.endpointPath !== this.props.endpointPath ||
      prevProps.query !== this.props.query
    ) {
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
    const {orgId, endpointPath} = this.props;
    const path = endpointPath ?? `/organizations/${orgId}/issues/`;

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

  onCursorChange(cursor, path, query, pageDiff) {
    const queryPageInt = parseInt(query.page, 10);
    let nextPage = isNaN(queryPageInt) ? pageDiff : queryPageInt + pageDiff;

    // unset cursor and page when we navigate back to the first page
    // also reset cursor if somehow the previous button is enabled on
    // first page and user attempts to go backwards
    if (nextPage <= 0) {
      cursor = undefined;
      nextPage = undefined;
    }

    browserHistory.push({
      pathname: path,
      query: {...query, cursor},
    });
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
    const {orgId, canSelectGroups, withChart} = this.props;
    const {loading, error, groups, memberList, pageLinks} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    } else if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    } else if (groups.length === 0) {
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

    return (
      <React.Fragment>
        <Panel>
          <GroupListHeader withChart={withChart} />
          <PanelBody>
            {groups.map(({id, project}) => {
              const members =
                memberList && memberList.hasOwnProperty(project.slug)
                  ? memberList[project.slug]
                  : null;

              return (
                <StreamGroup
                  key={id}
                  id={id}
                  orgId={orgId}
                  canSelect={canSelectGroups}
                  withChart={withChart}
                  memberList={members}
                />
              );
            })}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={pageLinks} onCursor={this.onCursorChange} />
      </React.Fragment>
    );
  },
});

export {GroupList};

export default withApi(GroupList);
