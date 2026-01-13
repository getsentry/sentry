import {Fragment, useCallback, useEffect, useState} from 'react';
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
import {useQuery} from 'sentry/utils/queryClient';
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
  const [mergedLinks, setMergedLinks] = useState<string | undefined>(undefined);
  const {project, groupId, location} = props;

  const onGroupingChange = useCallback(
    ({
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
    },
    []
  );

  useEffect(() => {
    const unsubscribe = GroupingStore.listen(onGroupingChange, undefined);
    return () => {
      unsubscribe();
    };
  }, [onGroupingChange]);

  const {refetch} = useQuery({
    queryKey: [
      `/organizations/${organization.slug}/issues/${groupId}/hashes/`,
      {query: {...location.query, limit: 50, query: location.query.query ?? ''}},
    ] as const,
    queryFn: ({queryKey}) => {
      // Not sure why query params are encoded into the "endpoint", but keeping behavior the same
      const endpoint = `${queryKey[0]}?${qs.stringify(queryKey[1].query)}`;
      // TODO: GroupingStore.onFetch is a nightmare, useQuery here is helping convert from class component.
      return GroupingStore.onFetch([{endpoint, dataKey: 'merged'}]);
    },
    staleTime: 30_000,
    retry: false,
  });

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
          onRetry={() => refetch()}
        />
      )}

      {isLoadedSuccessfully && (
        <MergedList
          project={project}
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
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
