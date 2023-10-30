import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QueryCount from 'sentry/components/queryCount';
import {t, tct} from 'sentry/locale';
import GroupingStore, {Fingerprint} from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
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

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
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
    const {params, location, organization} = this.props;
    const {groupId} = params;

    const queryParams = {
      ...location.query,
      limit: 50,
      query: this.state.query,
    };

    return `/organizations/${organization.slug}/issues/${groupId}/hashes/?${qs.stringify(
      queryParams
    )}`;
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
    const {organization, params} = this.props;
    GroupingStore.onUnmerge({
      groupId: params.groupId,
      orgSlug: organization.slug,
      loadingMessage: t('Unmerging events\u2026'),
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.'),
    });
    const unmergeKeys = [...GroupingStore.getState().unmergeList.values()];
    trackAnalytics('issue_details.merged_tab.unmerge_clicked', {
      organization,
      group_id: params.groupId,
      event_ids_unmerged: unmergeKeys.join(','),
      total_unmerged: unmergeKeys.length,
    });
  };

  render() {
    const {project, organization, params} = this.props;
    const {groupId} = params;
    const {loading: isLoading, error, mergedItems, mergedLinks} = this.state;
    const isError = error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;

    const fingerprintsWithLatestEvent = mergedItems.filter(
      ({latestEvent}) => !!latestEvent
    );

    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <HeaderWrapper>
            <Title>
              {tct('Fingerprints included in this issue [count]', {
                count: <QueryCount count={fingerprintsWithLatestEvent.length} />,
              })}
            </Title>
            <small>
              {
                // TODO: Once clickhouse is upgraded and the lag is no longer an issue, revisit this wording.
                // See https://github.com/getsentry/sentry/issues/56334.
                t(
                  'This is an experimental feature. All changes may take up to 24 hours take effect.'
                )
              }
            </small>
          </HeaderWrapper>

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
              organization={organization}
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

const Title = styled('h4')`
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;
