import {useEffect, useRef} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {IndexedMembersByProject} from 'sentry/utils/members/shared';

import {
  CodeChangesSummaryTag,
  OverviewAction,
  OverviewIssueTitle,
  OverviewSectionDisclosure,
  ReviewPrStatusTags,
  selectReviewPullRequest,
} from './overviewShared';
import type {StatusGroupKey} from './statusGroups';
import {OVERVIEW_SECTIONS, type OverviewRun, type ProjectConfig} from './types';
import {useIsInView} from './useIsInView';

// Shared by both section renderers so the card list and the table stay in lockstep.
export interface OverviewSectionRendererProps {
  collapsedGroups: StatusGroupKey[];
  isScmSettled: (seerRunId: string) => boolean;
  isVitalsPending: (seerRunId: string) => boolean;
  membersByProject: IndexedMembersByProject;
  onToggle: (groupKey: StatusGroupKey, expanded: boolean) => void;
  orgSlug: string;
  projectConfigById: Map<string, ProjectConfig>;
  requestScmWindow: (runIds: string[]) => void;
  resolvedTeamIds: Set<string>;
  scmWindowsByRunId: Map<string, string[][]>;
  sections: Array<(typeof OVERVIEW_SECTIONS)[number] & {runs: OverviewRun[]}>;
  statsPeriod: string | null;
  teamsSettled: boolean;
}

const TABLE_COLUMNS: TableColumnConfig[] = [
  {key: 'issue', width: 'minmax(0, 1fr)'},
  {key: 'badges', width: 'max-content'},
  {key: 'action', width: 'max-content'},
];

function RowBadges({
  run,
  sectionKey,
  reviewPullRequest,
}: {
  reviewPullRequest: OverviewRun['pullRequests'][number] | undefined;
  run: OverviewRun;
  sectionKey: StatusGroupKey;
}) {
  if (sectionKey === 'review_pr') {
    return reviewPullRequest ? (
      <Flex gap="xs" align="center" wrap="wrap" justify="end">
        <ReviewPrStatusTags pullRequest={reviewPullRequest} />
      </Flex>
    ) : null;
  }
  if (sectionKey === 'code_changes_ready') {
    return <CodeChangesSummaryTag codeChanges={run.codeChanges ?? []} />;
  }
  return null;
}

function OverviewTableRow({
  run,
  sectionKey,
  orgSlug,
  statsPeriod,
  vitalsPending,
  requestScmWindow,
  scmWindows,
  projectConfig,
}: {
  orgSlug: string;
  projectConfig: ProjectConfig | undefined;
  requestScmWindow: (runIds: string[]) => void;
  run: OverviewRun;
  scmWindows: string[][] | undefined;
  sectionKey: StatusGroupKey;
  statsPeriod: string | null;
  vitalsPending: boolean;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const inView = useIsInView(rowRef);
  useEffect(() => {
    if (inView && scmWindows) {
      for (const window of scmWindows) {
        requestScmWindow(window);
      }
    }
  }, [inView, scmWindows, requestScmWindow]);

  const issueUrl = `/organizations/${orgSlug}/issues/${run.groupId}/`;
  const reviewPullRequest =
    sectionKey === 'review_pr' ? selectReviewPullRequest(run.pullRequests) : undefined;

  return (
    <SimpleTable.Row ref={rowRef}>
      <SimpleTable.RowCell>
        <OverviewIssueTitle
          run={run}
          orgSlug={orgSlug}
          sectionKey={sectionKey}
          statsPeriod={statsPeriod}
          vitalsPending={vitalsPending}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" paddingRight="xs">
        <RowBadges
          run={run}
          sectionKey={sectionKey}
          reviewPullRequest={reviewPullRequest}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" paddingLeft="xs">
        <OverviewAction
          sectionKey={sectionKey}
          run={run}
          reviewPullRequest={reviewPullRequest}
          issueUrl={issueUrl}
          projectConfig={projectConfig}
          showReviewTags={false}
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

export function OverviewSectionTable({
  sections,
  collapsedGroups,
  onToggle,
  orgSlug,
  statsPeriod,
  requestScmWindow,
  scmWindowsByRunId,
  isVitalsPending,
  projectConfigById,
}: OverviewSectionRendererProps) {
  return (
    <Stack gap="lg">
      {sections.map(({key, runs}) => (
        <OverviewSectionDisclosure
          key={key}
          sectionKey={key}
          count={runs.length}
          expanded={!collapsedGroups.includes(key)}
          onToggle={next => onToggle(key, next)}
        >
          <Stack paddingTop="sm">
            <SimpleTable columns={TABLE_COLUMNS}>
              {runs.map(run => (
                <OverviewTableRow
                  key={run.seerRunId}
                  run={run}
                  sectionKey={key}
                  orgSlug={orgSlug}
                  statsPeriod={statsPeriod}
                  vitalsPending={isVitalsPending(run.seerRunId)}
                  requestScmWindow={requestScmWindow}
                  scmWindows={scmWindowsByRunId.get(run.seerRunId)}
                  projectConfig={projectConfigById.get(run.issue.project.id)}
                />
              ))}
            </SimpleTable>
          </Stack>
        </OverviewSectionDisclosure>
      ))}
    </Stack>
  );
}
