import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import * as queryString from 'query-string';

import GroupingActions from 'app/actions/groupingActions';
import Alert from 'app/components/alert';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import GroupingStore, {Fingerprint} from 'app/stores/groupingStore';
import {Group, Organization, Project} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';
import withOrganization from 'app/utils/withOrganization';

import MergedList from './mergedList';

type Props = RouteComponentProps<
  {groupId: Group['id']; orgId: Organization['slug']},
  {}
> & {
  project: Project;
  organization: Organization;
};

type State = {
  query: string;
  loading: boolean;
  error: boolean;
  mergedItems: Array<Fingerprint>;
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
    callIfFunction(this.listener);
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

    return `/issues/${groupId}/hashes/?${queryString.stringify(queryParams)}`;
  }

  fetchData = () => {
    GroupingActions.fetch([
      {
        endpoint: this.getEndpoint(),
        dataKey: 'merged',
        queryParams: this.props.location.query,
      },
    ]);
  };

  handleUnmerge = () => {
    GroupingActions.unmerge({
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
      <Fragment>
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
            onToggleCollapse={GroupingActions.toggleCollapseFingerprints}
          />
        )}
      </Fragment>
    );
  }
}

export {GroupMergedView};

export default withOrganization(GroupMergedView);
