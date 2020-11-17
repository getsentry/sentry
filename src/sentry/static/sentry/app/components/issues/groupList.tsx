import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';
import * as qs from 'query-string';

import {Client} from 'app/api';
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
import {Group} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';

import GroupListHeader from './groupListHeader';

const defaultProps = {
  canSelectGroups: true,
  withChart: true,
  withPagination: true,
};

type Props = {
  api: Client;
  query: string;
  orgId: string;
  endpointPath: string;
  renderEmptyMessage?: () => React.ReactNode;
  queryParams?: Record<string, number | string | string[] | undefined | null>;
} & Partial<typeof defaultProps>;

type State = {
  loading: boolean;
  error: boolean;
  groups: Group[];
  pageLinks: string | null;
  memberList?: ReturnType<typeof indexMembersByProject>;
};

class GroupList extends React.Component<Props, State> {
  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = defaultProps;

  state: State = {
    loading: true,
    error: false,
    groups: [],
    pageLinks: null,
  };
  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return (
      !isEqual(this.state, nextState) ||
      nextProps.endpointPath !== this.props.endpointPath ||
      nextProps.query !== this.props.query ||
      !isEqual(nextProps.queryParams, this.props.queryParams)
    );
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.orgId !== this.props.orgId ||
      prevProps.endpointPath !== this.props.endpointPath ||
      prevProps.query !== this.props.query ||
      !isEqual(prevProps.queryParams, this.props.queryParams)
    ) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    GroupStore.reset();
    callIfFunction(this.listener);
  }

  listener = GroupStore.listen(() => this.onGroupChange(), undefined);
  private _streamManager = new StreamManager(GroupStore);

  async fetchData() {
    GroupStore.loadInitialData([]);
    const {api, orgId} = this.props;

    this.setState({loading: true, error: false});

    fetchOrgMembers(api, orgId).then(members => {
      this.setState({memberList: indexMembersByProject(members)});
    });

    const endpoint = this.getGroupListEndpoint();

    try {
      const [data, , jqXHR] = await api.requestPromise(endpoint);
      this._streamManager.push(data);

      this.setState({
        error: false,
        loading: false,
        pageLinks: jqXHR?.getResponseHeader('Link') ?? null,
      });
    } catch {
      this.setState({error: true, loading: false});
    }
  }

  getGroupListEndpoint() {
    const {orgId, endpointPath, queryParams} = this.props;
    const path = endpointPath ?? `/organizations/${orgId}/issues/`;
    const queryParameters = queryParams ?? this.getQueryParams();

    return `${path}?${qs.stringify(queryParameters)}`;
  }

  getQueryParams() {
    const {query} = this.props;

    const queryParams = this.context.location.query;
    queryParams.limit = 50;
    queryParams.sort = 'new';
    queryParams.query = query;

    return queryParams;
  }

  handleCursorChange(
    cursor: string,
    path: string,
    query: Record<string, any>,
    pageDiff: number
  ) {
    const queryPageInt = parseInt(query.page, 10);
    let nextPage: number | undefined = isNaN(queryPageInt)
      ? pageDiff
      : queryPageInt + pageDiff;
    let nextCursor: string | undefined = cursor;

    // unset cursor and page when we navigate back to the first page
    // also reset cursor if somehow the previous button is enabled on
    // first page and user attempts to go backwards
    if (nextPage <= 0) {
      nextCursor = undefined;
      nextPage = undefined;
    }

    browserHistory.push({
      pathname: path,
      query: {...query, cursor: nextCursor},
    });
  }

  onGroupChange() {
    const groups = this._streamManager.getAllItems();
    if (!isEqual(groups, this.state.groups)) {
      this.setState({groups});
    }
  }

  render() {
    const {canSelectGroups, withChart, renderEmptyMessage, withPagination} = this.props;
    const {loading, error, groups, memberList, pageLinks} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (groups.length === 0) {
      if (typeof renderEmptyMessage === 'function') {
        return renderEmptyMessage();
      }
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
          <GroupListHeader withChart={!!withChart} />
          <PanelBody>
            {groups.map(({id, project}) => {
              const members = memberList?.hasOwnProperty(project.slug)
                ? memberList[project.slug]
                : undefined;

              return (
                <StreamGroup
                  key={id}
                  id={id}
                  canSelect={canSelectGroups}
                  withChart={withChart}
                  memberList={members}
                  useFilteredStats
                />
              );
            })}
          </PanelBody>
        </Panel>
        {withPagination && (
          <Pagination pageLinks={pageLinks} onCursor={this.handleCursorChange} />
        )}
      </React.Fragment>
    );
  }
}

export {GroupList};

export default withApi(GroupList);
