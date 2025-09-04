import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Location, Query} from 'history';
import * as qs from 'query-string';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QueryCount from 'sentry/components/queryCount';
import {t, tct} from 'sentry/locale';
import type {Fingerprint} from 'sentry/stores/groupingStore';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import MergedList from './mergedList';

type Props = {
  groupId: Group['id'];
  location: Location<Query>;
  project: Project;
};

function GroupMergedView(props: Props) {
  const organization = useOrganization();
  const [mergedItems, setMergedItems] = useState<Fingerprint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [query, setQuery] = useState<string>(
    (props.location.query.query as string | undefined) ?? ''
  );
  const [mergedLinks, setMergedLinks] = useState<string | undefined>(undefined);
  const {project, groupId, location} = props;

  const onGroupingChange = ({
    mergedItems: items,
    mergedLinks: links,
    loading: l,
    error: e,
  }: ReturnType<typeof GroupingStore.getState>) => {
    if (items) {
      setMergedItems(items);
      setMergedLinks(links);
      setIsLoading(typeof l === 'undefined' ? false : l);
      setError(typeof e === 'undefined' ? false : e);
    }
  };

  useEffect(() => {
    const unsubscribe = GroupingStore.listen(onGroupingChange, undefined);
    return () => {
      unsubscribe?.();
    };
  }, []);

  const getEndpoint = (queryOverride?: string) => {
    const queryParams = {
      ...location.query,
      limit: 50,
      query: queryOverride ?? query,
    };
    return `/organizations/${organization.slug}/issues/${groupId}/hashes/?${qs.stringify(
      queryParams
    )}`;
  };

  const fetchData = (queryOverride?: string) => {
    GroupingStore.onFetch([
      {
        endpoint: getEndpoint(queryOverride),
        dataKey: 'merged',
        queryParams: location.query,
      },
    ]);
  };

  useEffect(() => {
    const nextQuery = (location.query.query as string | undefined) ?? '';
    setQuery(nextQuery);
    const queryParams = {
      ...location.query,
      limit: 50,
      query: nextQuery,
    };
    const endpoint = `/organizations/${organization.slug}/issues/${groupId}/hashes/?${qs.stringify(
      queryParams
    )}`;
    GroupingStore.onFetch([
      {
        endpoint,
        dataKey: 'merged',
        queryParams: location.query,
      },
    ]);
  }, [groupId, location.search, location.query, organization.slug]);

  const handleUnmerge = () => {
    GroupingStore.onUnmerge({
      groupId,
      orgSlug: organization.slug,
      loadingMessage: t('Unmerging events\u2026'),
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.'),
    });
    const unmergeKeys = [...GroupingStore.getState().unmergeList.values()];
    trackAnalytics('issue_details.merged_tab.unmerge_clicked', {
      organization,
      group_id: groupId,
      event_ids_unmerged: unmergeKeys.join(','),
      total_unmerged: unmergeKeys.length,
    });
  };

  const isError = error && !isLoading;
  const isLoadedSuccessfully = !isError && !isLoading;

  const fingerprintsWithLatestEvent = mergedItems.filter(
    ({latestEvent}) => !!latestEvent
  );

  return (
    <Fragment>
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
          onRetry={() => fetchData()}
        />
      )}

      {isLoadedSuccessfully && (
        <MergedList
          project={project}
          organization={organization}
          fingerprints={mergedItems}
          pageLinks={mergedLinks}
          groupId={groupId}
          onUnmerge={handleUnmerge}
          onToggleCollapse={GroupingStore.onToggleCollapseFingerprints}
        />
      )}
    </Fragment>
  );
}

export default GroupMergedView;

const Title = styled('h4')`
  font-size: ${p => p.theme.fontSize.lg};
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;
