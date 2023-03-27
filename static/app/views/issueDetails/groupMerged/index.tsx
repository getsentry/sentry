import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import * as qs from 'query-string';

import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import GroupingStore, {Fingerprint} from 'sentry/stores/groupingStore';
import {Group, Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import MergedList from './mergedList';

type Props = RouteComponentProps<
  {groupId: Group['id']; orgId: Organization['slug']},
  {}
> & {
  organization: Organization;
  project: Project;
};

type State = {
  error: boolean;
  loading: boolean;
  mergedItems: Array<Fingerprint>;
  query: string;
  mergedLinks?: string;
};

class GroupMergedView extends Component<Props, State> {
  state: State = {
    mergedItems: [],
    loading: true,
    error: false,
    query: this.props.location.query.query || '',
  };

  componentDidMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      nextProps.params.groupId !== this.props.params.groupId ||
      nextProps.location.search !== this.props.location.search
    ) {
      const queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }
  }

  componentWillUnmount() {
    this.listener?.();
  }

  onGroupingChange = ({mergedItems, mergedLinks, loading, error}) => {
    if (mergedItems) {
      this.setState({
        mergedItems,
        mergedLinks,
        loading: typeof loading !== 'undefined' ? loading : false,
        error: typeof error !== 'undefined' ? error : false,
      });
    }
  };

  listener = GroupingStore.listen(this.onGroupingChange, undefined);

  getEndpoint() {
    const {params, location} = this.props;
    const {groupId} = params;

    const queryParams = {
      ...location.query,
      limit: 50,
      query: this.state.query,
    };

    return `/issues/${groupId}/hashes/?${qs.stringify(queryParams)}`;
  }

  fetchData = () => {
    GroupingStore.onFetch([
      {
        endpoint: this.getEndpoint(),
        dataKey: 'merged',
        queryParams: this.props.location.query,
      },
    ]);
  };

  handleUnmerge = () => {
    GroupingStore.onUnmerge({
      groupId: this.props.params.groupId,
      loadingMessage: t('Unmerging events\u2026'),
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.'),
    });
  };

  render() {
    const {project, params} = this.props;
    const {groupId} = params;
    const {loading: isLoading, error, mergedItems, mergedLinks} = this.state;
    const isError = error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;

    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <Alert type="warning">
            {t(
              'This is an experimental feature. Data may not be immediately available while we process unmerges.'
            )}
          </Alert>

          {isLoading && <LoadingIndicator />}
          {isError && (
            <LoadingError
              message={t('Unable to load merged events, please try again later')}
              onRetry={this.fetchData}
            />
          )}

          {isLoadedSuccessfully && (
            <MergedList
              project={project}
              fingerprints={mergedItems}
              pageLinks={mergedLinks}
              groupId={groupId}
              onUnmerge={this.handleUnmerge}
              onToggleCollapse={GroupingStore.onToggleCollapseFingerprints}
            />
          )}
        </Layout.Main>
      </Layout.Body>
    );
  }
}

export {GroupMergedView};

export default withOrganization(GroupMergedView);
