import {Component} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import IssuesReplayCountProvider from 'sentry/components/replays/issuesReplayCountProvider';
import {t} from 'sentry/locale';
import GroupingStore, {SimilarItem} from 'sentry/stores/groupingStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';

import List from './list';

type RouteParams = {
  groupId: string;
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  location: Location;
  project: Project;
};

type State = {
  error: boolean;
  filteredSimilarItems: SimilarItem[];
  loading: boolean;
  similarItems: SimilarItem[];
  similarLinks: string | null;
  v2: boolean;
};

class SimilarStackTrace extends Component<Props, State> {
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
    this.listener?.();
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

  fetchData() {
    const {params, location} = this.props;

    this.setState({loading: true, error: false});

    const reqs: Parameters<typeof GroupingStore.onFetch>[0] = [];

    if (this.hasSimilarityFeature()) {
      const version = this.state.v2 ? '2' : '1';

      reqs.push({
        endpoint: `/issues/${params.groupId}/similar/?${qs.stringify({
          ...location.query,
          limit: 50,
          version,
        })}`,
        dataKey: 'similar',
      });
    }

    GroupingStore.onFetch(reqs);
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

    GroupingStore.onMerge({
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
    const {similarItems, filteredSimilarItems, loading, error, v2, similarLinks} =
      this.state;

    const hasV2 = this.hasSimilarityV2Feature();
    const isLoading = loading;
    const isError = error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;
    const hasSimilarItems =
      this.hasSimilarityFeature() &&
      (similarItems.length > 0 || filteredSimilarItems.length > 0) &&
      isLoadedSuccessfully;

    const groupsIds = similarItems
      .concat(filteredSimilarItems)
      .map(({issue}) => issue.id);

    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <Alert type="warning">
            {t(
              'This is an experimental feature. Data may not be immediately available while we process merges.'
            )}
          </Alert>
          <HeaderWrapper>
            <Title>{t('Issues with a similar stack trace')}</Title>
            {hasV2 && (
              <ButtonBar merged active={v2 ? 'new' : 'old'}>
                <Button barId="old" size="sm" onClick={this.toggleSimilarityVersion}>
                  {t('Old Algorithm')}
                </Button>
                <Button barId="new" size="sm" onClick={this.toggleSimilarityVersion}>
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
            <IssuesReplayCountProvider groupIds={groupsIds}>
              <List
                items={similarItems}
                filteredItems={filteredSimilarItems}
                onMerge={this.handleMerge}
                orgId={orgId}
                project={project}
                groupId={groupId}
                pageLinks={similarLinks}
                v2={v2}
              />
            </IssuesReplayCountProvider>
          )}
        </Layout.Main>
      </Layout.Body>
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
