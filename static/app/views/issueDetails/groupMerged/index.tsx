import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {MergedList} from './mergedList';
import {
  type Fingerprint,
  useGroupMergedHashes,
  useGroupMergedState,
} from './useGroupMerged';

type Props = {
  groupId: Group['id'];
  project: Project;
};

const MERGED_ISSUES_DOCS_LINK =
  'https://docs.sentry.io/product/issues/grouping-and-fingerprints/#merging-similar-issues';

interface GroupMergedContentProps {
  error: boolean;
  fingerprints: Fingerprint[];
  groupId: Group['id'];
  loading: boolean;
  organization: Organization;
  project: Project;
  refetch: () => void;
  pageLinks?: string;
}

export function GroupMergedView({project, groupId}: Props) {
  const organization = useOrganization();
  const {dataUpdatedAt, error, fingerprints, loading, pageLinks, refetch} =
    useGroupMergedHashes({
      groupId,
      organization,
    });

  return (
    <GroupMergedContent
      key={`${groupId}:${dataUpdatedAt}`}
      error={error}
      fingerprints={fingerprints}
      groupId={groupId}
      loading={loading}
      organization={organization}
      pageLinks={pageLinks}
      project={project}
      refetch={refetch}
    />
  );
}

function GroupMergedContent({
  error,
  fingerprints,
  groupId,
  loading,
  organization,
  pageLinks,
  project,
  refetch,
}: GroupMergedContentProps) {
  const {
    enableFingerprintCompare,
    fingerprintsWithLatestEvent,
    selectedEventIds,
    state,
    toggleAllCollapsed,
    toggleCollapsed,
    toggleSelected,
    unmerge,
    unmergeDisabled,
  } = useGroupMergedState({fingerprints, groupId, organization});

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
  const isLoadedSuccessfully = !error && !loading;

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Heading as="h4" size="lg">
          {t('Fingerprints included in this issue')}
        </Heading>
        <Text as="p" size="sm" variant="muted">
          {
            // TODO: Once clickhouse is upgraded and the lag is no longer an issue, revisit this wording.
            // See https://github.com/getsentry/sentry/issues/56334.
            tct(
              'These fingerprints identify events that have been merged into this issue. Changes may take up to 24 hours to take effect. [learnMore:Learn more]',
              {
                learnMore: <ExternalLink href={MERGED_ISSUES_DOCS_LINK} />,
              }
            )
          }
        </Text>
      </Stack>

      {loading && <LoadingIndicator />}
      {isError && (
        <LoadingError
          message={t('Unable to load merged events, please try again later')}
          onRetry={refetch}
        />
      )}

      {isLoadedSuccessfully && (
        <MergedList
          project={project}
          fingerprints={fingerprintsWithLatestEvent}
          pageLinks={pageLinks}
          groupId={groupId}
          enableFingerprintCompare={enableFingerprintCompare}
          state={state}
          toggleCollapsed={toggleCollapsed}
          toggleSelected={toggleSelected}
          unmergeDisabled={unmergeDisabled}
          onUnmerge={handleUnmerge}
          onToggleCollapse={toggleAllCollapsed}
        />
      )}
    </Stack>
  );
}
