import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {QueryCount} from 'sentry/components/queryCount';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {MergedList} from './mergedList';
import {GroupMergedProvider, useGroupMerged} from './useGroupMerged';

type Props = {
  groupId: Group['id'];
  location: Location;
  project: Project;
};

export function GroupMergedView(props: Props) {
  const organization = useOrganization();
  const {groupId, location} = props;

  return (
    <GroupMergedProvider
      groupId={groupId}
      location={location}
      organization={organization}
    >
      <GroupMergedContent {...props} />
    </GroupMergedProvider>
  );
}

function GroupMergedContent({project, groupId}: Props) {
  const organization = useOrganization();
  const {
    error,
    fingerprints,
    fingerprintsWithLatestEvent,
    loading,
    pageLinks,
    refetch,
    selectedEventIds,
    toggleAllCollapsed,
    unmerge,
  } = useGroupMerged();

  const handleUnmerge = () => {
    unmerge({
      loadingMessage: t('Unmerging events\u2026'),
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.'),
    });
    trackAnalytics('issue_details.merged_tab.unmerge_clicked', {
      organization,
      group_id: groupId,
      event_ids_unmerged: selectedEventIds.join(','),
      total_unmerged: selectedEventIds.length,
    });
  };

  const isError = error && !loading;
  const isLoadedSuccessfully = !isError && !loading;

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

      {loading && <LoadingIndicator />}
      {isError && (
        <LoadingError
          message={t('Unable to load merged events, please try again later')}
          onRetry={() => refetch()}
        />
      )}

      {isLoadedSuccessfully && (
        <MergedList
          project={project}
          fingerprints={fingerprints}
          pageLinks={pageLinks}
          groupId={groupId}
          onUnmerge={handleUnmerge}
          onToggleCollapse={toggleAllCollapsed}
        />
      )}
    </Fragment>
  );
}

const Title = styled('h4')`
  font-size: ${p => p.theme.font.size.lg};
  margin-bottom: ${p => p.theme.space.sm};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};

  small {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
