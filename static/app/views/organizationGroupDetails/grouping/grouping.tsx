import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GroupingActions from 'app/actions/groupingActions';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import GroupingStore, {Fingerprint} from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';

import GroupedIssues from './groupedIssues';
import MergedIssues from './mergedIssues';

type Props = {
  organization: Organization;
  project: Project;
  groupId: Group['id'];
  location: Location;
};

type State = {
  mergedIssues: Fingerprint[];
  mergedIssuesPagination: string;
  enableCompareButton: boolean;
  isLoading: boolean;
  hasError: boolean;
};

function Grouping({groupId, location, organization, project}: Props) {
  const [groupingState, setGroupingState] = useState<State>({
    mergedIssues: [],
    mergedIssuesPagination: '',
    enableCompareButton: false,
    isLoading: true,
    hasError: false,
  });

  const [unMergedIssueIds, setUnMergedIssueIds] = useState<string[]>([]);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);

  useEffect(() => {
    const listener = GroupingStore.listen(onGroupingChange, undefined);
    fetchData();
    return () => {
      listener();
    };
  }, []);

  function fetchData() {
    GroupingActions.fetch([
      {
        endpoint: `/issues/${groupId}/hashes/split/`,
        dataKey: 'merged',
        queryParams: location.query,
      },
    ]);
  }

  function onGroupingChange({
    mergedItems: mergedIssues,
    mergedLinks: mergedIssuesPagination,
    enableFingerprintCompare,
    unmergeState,
    loading: isLoading,
    error: hasError,
  }) {
    setSelectedIssueIds(
      [...unmergeState].filter(([_key, {checked}]) => checked).map(([key]) => key)
    );

    if (!mergedIssues) {
      setUnMergedIssueIds(
        [...unmergeState].filter(([_key, {busy}]) => busy).map(([key]) => key)
      );
      return;
    }

    setGroupingState({
      isLoading,
      hasError,
      mergedIssuesPagination,
      mergedIssues,
      enableCompareButton: !enableFingerprintCompare,
    });
  }

  const {
    isLoading,
    hasError,
    mergedIssues,
    mergedIssuesPagination,
    enableCompareButton,
  } = groupingState;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (hasError) {
    return (
      <LoadingError
        message={t('Unable to load grouping data, please try again later')}
        onRetry={fetchData}
      />
    );
  }

  const mergedIssuesWithLastestEvent =
    unMergedIssueIds.length > 0
      ? mergedIssues.filter(
          ({id, latestEvent}) => !unMergedIssueIds.includes(id) && !!latestEvent
        )
      : mergedIssues.filter(({latestEvent}) => !!latestEvent);

  return (
    <Wrapper>
      <MergedIssues
        groupId={groupId}
        project={project}
        organization={organization}
        location={location}
        issues={mergedIssuesWithLastestEvent}
        selectedIssueIds={selectedIssueIds}
        pagination={mergedIssuesPagination}
        enableCompareButton={enableCompareButton}
      />
      <GroupedIssues issues={mergedIssuesWithLastestEvent} groupId={groupId} />
    </Wrapper>
  );
}

export default Grouping;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
