import {RouteComponentProps} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import styled from '@emotion/styled';
import React from 'react';
import * as queryString from 'query-string';

import {t} from 'app/locale';
import space from 'app/styles/space';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import {Project} from 'app/types';
import Alert from 'app/components/alert';
import {callIfFunction} from 'app/utils/callIfFunction';

import List from './list';

type ListProps = React.ComponentProps<typeof List>;

type SimilarItems = ListProps['items'];
type RouteParams = {
  orgId: string;
  groupId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  project: Project;
  location: Location;
};

type State = {
  similarItems: SimilarItems;
  filteredSimilarItems: SimilarItems;
  similarLinks: string | null;
  loading: boolean;
  error: boolean;
  v2: boolean;
};

class SimilarStackTrace extends React.Component<Props, State> {
  state: State = {
    similarItems: [],
    filteredSimilarItems: [],
    similarLinks: null,
    loading: true,
    error: false,
    v2: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      nextProps.params.groupId !== this.props.params.groupId ||
      nextProps.location.search !== this.props.location.search
    ) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    callIfFunction(this.listener);
  }

  onGroupingChange = ({
    mergedParent,
    similarItems,
    similarLinks,
    filteredSimilarItems,
    loading,
    error,
  }) => {
    if (similarItems) {
      this.setState({
        similarItems,
        similarLinks,
        filteredSimilarItems,
        loading: loading ?? false,
        error: error ?? false,
      });
      return;
    }

    if (!mergedParent) {
      return;
    }

    if (mergedParent !== this.props.params.groupId) {
      const {params} = this.props;
      // Merge success, since we can't specify target, we need to redirect to new parent
      browserHistory.push(
        `/organizations/${params.orgId}/issues/${mergedParent}/similar/`
      );

      return;
    }

    return;
  };

  listener = GroupingStore.listen(this.onGroupingChange, undefined);

  getEndpoint(type = 'similar') {
    const {params, location} = this.props;

    const queryParams = {
      ...location.query,
      limit: 50,
      version: this.state.v2 ? '2' : '1',
    };

    return `/issues/${params.groupId}/${type}/?${queryString.stringify(queryParams)}`;
  }

  fetchData() {
    this.setState({loading: true, error: false});

    const reqs: Array<{endpoint: string; dataKey: string}> = [];

    if (this.hasSimilarityFeature()) {
      reqs.push({
        endpoint: this.getEndpoint('similar'),
        dataKey: 'similar',
      });
    }

    GroupingActions.fetch(reqs);
  }

  handleMerge = () => {
    const {params, location} = this.props;
    const query = location.query;

    if (!params) {
      return;
    }

    // You need at least 1 similarItem OR filteredSimilarItems to be able to merge,
    // so `firstIssue` should always exist from one of those lists.
    //
    // Similar issues API currently does not return issues across projects,
    // so we can assume that the first issues project slug is the project in
    // scope
    const [firstIssue] = this.state.similarItems.length
      ? this.state.similarItems
      : this.state.filteredSimilarItems;

    GroupingActions.merge({
      params,
      query,
      projectId: firstIssue.issue.project.slug,
    });
  };

  hasSimilarityV2Feature() {
    return this.props.project.features.includes('similarity-view-v2');
  }

  hasSimilarityFeature() {
    return this.props.project.features.includes('similarity-view');
  }

  toggleSimilarityVersion = () => {
    this.setState(prevState => ({v2: !prevState.v2}), this.fetchData);
  };

  render() {
    const {params, project} = this.props;
    const {orgId, groupId} = params;
    const {
      similarItems,
      filteredSimilarItems,
      loading,
      error,
      v2,
      similarLinks,
    } = this.state;

    const hasV2 = this.hasSimilarityV2Feature();
    const isLoading = loading;
    const isError = error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;
    const hasSimilarItems =
      this.hasSimilarityFeature() &&
      (similarItems.length >= 0 || filteredSimilarItems.length >= 0) &&
      isLoadedSuccessfully;

    return (
      <React.Fragment>
        <Alert type="warning">
          {t(
            'This is an experimental feature. Data may not be immediately available while we process merges.'
          )}
        </Alert>
        <HeaderWrapper>
          <Title>{t('Issues with a similar stack trace')}</Title>
          {hasV2 && (
            <ButtonBar merged active={v2 ? 'new' : 'old'}>
              <Button barId="old" size="small" onClick={this.toggleSimilarityVersion}>
                {t('Old Algorithm')}
              </Button>
              <Button barId="new" size="small" onClick={this.toggleSimilarityVersion}>
                {t('New Algorithm')}
              </Button>
            </ButtonBar>
          )}
        </HeaderWrapper>
        {isLoading && <LoadingIndicator />}
        {isError && (
          <LoadingError
            message={t('Unable to load similar issues, please try again later')}
            onRetry={this.fetchData}
          />
        )}
        {hasSimilarItems && (
          <List
            items={similarItems}
            filteredItems={filteredSimilarItems}
            onMerge={this.handleMerge}
            orgId={orgId}
            project={project}
            groupId={groupId}
            pageLinks={similarLinks}
          />
        )}
      </React.Fragment>
    );
  }
}

export default SimilarStackTrace;

const Title = styled('h4')`
  margin-bottom: 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;
