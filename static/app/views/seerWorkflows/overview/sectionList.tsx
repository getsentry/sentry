import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Sticky} from 'sentry/components/sticky';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {indexMembersByProject} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {DEFAULT_STATS_PERIOD} from './periods';
import {SectionIssueCard} from './sectionIssueCard';
import {STATUS_GROUP_META, StatusGroupTooltip, type StatusGroupKey} from './statusGroups';
import type {AutofixStateKey, OverviewView, SortValue} from './types';
import {SECTION_LIMIT, useAutofixSections} from './useAutofixSections';
import {useSectionRuns} from './useSectionRuns';

const PAGE_SIZE = 10;

function formatSectionCount(count: number | undefined) {
  if (count === undefined) {
    return '…';
  }
  return count > SECTION_LIMIT ? `${SECTION_LIMIT}+` : count;
}

function useMemberQuery(memberProjectIds: string[], enabled: boolean) {
  return useQuery({
    ...useProjectMembersQueryOptions(memberProjectIds),
    select: response => indexMembersByProject(response.json),
    enabled,
  });
}

function SectionBody({
  section,
  visibleCount,
  onShowMore,
  memberQuery,
  orgSlug,
  view,
  period,
}: {
  memberQuery: ReturnType<typeof useMemberQuery>;
  onShowMore: () => void;
  orgSlug: string;
  period: string;
  section: ReturnType<typeof useAutofixSections>['sections'][number];
  view: OverviewView;
  visibleCount: number;
}) {
  const visibleIssues = useMemo(
    () => section.issues.slice(0, visibleCount),
    [section.issues, visibleCount]
  );
  const groupIds = useMemo(() => visibleIssues.map(issue => issue.id), [visibleIssues]);
  // runMap is recreated on every render, so it must never be a hook dependency.
  const {runMap, runsPending} = useSectionRuns(groupIds);
  const remaining = section.issues.length - visibleIssues.length;

  return (
    <SectionRows
      gap={view === 'cards' ? 'md' : '0'}
      paddingTop={view === 'cards' ? 'sm' : '0'}
      data-view={view}
    >
      {visibleIssues.map(issue => (
        <SectionIssueCard
          key={issue.id}
          issue={issue}
          injectedRun={runMap.get(issue.id) ?? null}
          // While the batch is in flight the card waits rather than fetching;
          // once settled, a card the batch didn't cover falls back to its own
          // request (only happens when a group has multiple runs).
          batchPending={runsPending}
          memberList={
            memberQuery.isError
              ? undefined
              : (memberQuery.data?.get(issue.project.slug) ?? [])
          }
          memberListLoading={memberQuery.isPending}
          orgSlug={orgSlug}
          sectionKey={section.key}
          view={view}
          statsPeriod={period}
        />
      ))}
      {remaining > 0 && (
        <Flex justify="center" padding="sm">
          <Button
            size="sm"
            variant="transparent"
            icon={<IconChevron direction="down" />}
            onClick={onShowMore}
          >
            {tct('Show [count] more', {count: Math.min(PAGE_SIZE, remaining)})}
          </Button>
        </Flex>
      )}
    </SectionRows>
  );
}

export function SectionList({
  assignee,
  collapsedGroups,
  enabled,
  onToggleGroup,
  period,
  projects,
  sort,
  view,
}: {
  collapsedGroups: StatusGroupKey[];
  enabled: boolean;
  onToggleGroup: (groupKey: StatusGroupKey, expanded: boolean) => void;
  period: string;
  projects: number[];
  sort: SortValue;
  view: OverviewView;
  assignee?: string;
}) {
  const organization = useOrganization();
  const {projects: orgProjects} = useProjects();
  const {sections, isPending, isError, refetch} = useAutofixSections({
    enabled,
    projects,
    sort: sort === 'events' ? 'freq' : 'date',
    statsPeriod: period,
    assignee,
  });
  const memberProjectIds = useMemo(() => projects.map(String), [projects]);
  const hasCardIssues =
    view === 'cards' && sections.some(section => section.issues.length > 0);
  const memberQuery = useMemberQuery(memberProjectIds, enabled && hasCardIssues);

  // A fresh issues query (any filter/sort/period/project change) means fresh
  // pages — reset every section back to the first PAGE_SIZE. The key is stored
  // with the counts and compared during render so a mount doesn't spend an
  // extra render resetting state that is already empty.
  const resetKey = JSON.stringify({projects, sort, period, assignee});
  const [pages, setPages] = useState<{
    counts: Partial<Record<AutofixStateKey, number>>;
    key: string;
  }>({counts: {}, key: resetKey});
  const visibleCounts = pages.key === resetKey ? pages.counts : {};
  if (pages.key !== resetKey) {
    setPages({counts: {}, key: resetKey});
  }

  const showMore = (key: AutofixStateKey) => {
    setPages(prev => ({
      key: prev.key,
      counts: {...prev.counts, [key]: (prev.counts[key] ?? PAGE_SIZE) + PAGE_SIZE},
    }));
  };

  const firstLoad = isPending && sections.every(section => section.isPending);
  const allSectionsEmpty = sections.every(
    section => !section.isPending && !section.isError && section.issues.length === 0
  );
  const hasProjectFilter = projects.length > 0 && orgProjects.length > 1;
  const hasNonDefaultFilters =
    hasProjectFilter || period !== DEFAULT_STATS_PERIOD || Boolean(assignee);

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }
  if (firstLoad) {
    return <LoadingIndicator />;
  }
  if (allSectionsEmpty) {
    return (
      <Container border="primary" radius="md" padding="xl">
        <Text as="p" variant="muted" align="center">
          {hasNonDefaultFilters
            ? t('No autofix runs match your filters.')
            : t('No completed autofix runs yet.')}
        </Text>
      </Container>
    );
  }

  return (
    <Stack gap="lg">
      {sections.map(section => {
        const meta = STATUS_GROUP_META[section.key];
        const expanded = !collapsedGroups.includes(section.key);
        return (
          <StatusGroup
            key={section.key}
            size="sm"
            expanded={expanded}
            onExpandedChange={next => onToggleGroup(section.key, next)}
            data-view={view}
          >
            <GroupHeader data-view={view} data-expanded={expanded}>
              <Disclosure.Title>
                <Flex gap="sm" align="center">
                  <Tooltip
                    title={<StatusGroupTooltip groupKey={section.key} />}
                    skipWrapper
                  >
                    <meta.Icon size="sm" aria-hidden />
                  </Tooltip>
                  <Text bold>{meta.label}</Text>
                  <Badge variant="muted">{formatSectionCount(section.count)}</Badge>
                </Flex>
              </Disclosure.Title>
            </GroupHeader>
            {/* Disclosure.Content only toggles `hidden`, so its children stay
                mounted while collapsed. The body is unmounted explicitly to keep
                a closed section from fetching runs for issues nobody asked to
                see; the page counts live in SectionList, so reopening restores
                whatever page the section had grown to. */}
            <Disclosure.Content data-view={view}>
              {expanded ? (
                section.isError ? (
                  <LoadingError onRetry={section.refetch} />
                ) : section.isPending ? (
                  <LoadingIndicator />
                ) : section.issues.length === 0 ? (
                  <Container padding="md">
                    <Text as="p" variant="muted" size="sm">
                      {t('No issues')}
                    </Text>
                  </Container>
                ) : (
                  <SectionBody
                    section={section}
                    visibleCount={visibleCounts[section.key] ?? PAGE_SIZE}
                    onShowMore={() => showMore(section.key)}
                    memberQuery={memberQuery}
                    orgSlug={organization.slug}
                    view={view}
                    period={period}
                  />
                )
              ) : null}
            </Disclosure.Content>
          </StatusGroup>
        );
      })}
    </Stack>
  );
}

const SectionRows = styled(Stack)`
  &[data-view='table'] > *:last-child {
    border-bottom: none;
  }
`;

// Disclosure.Content adds panel padding by default. Cards keep the vertical
// spacing, but table rows should sit flush against the group border and header.
const StatusGroup = styled(Disclosure)`
  &[data-view='table'] {
    position: relative;
    border-radius: ${p => p.theme.radius.md};

    &::after {
      content: '';
      position: absolute;
      z-index: ${p => p.theme.zIndex.initial + 1};
      inset: 0;
      border: 1px solid ${p => p.theme.tokens.border.primary};
      border-radius: inherit;
      pointer-events: none;
    }
  }

  && > * + * {
    padding-left: 0;
    padding-right: 0;
  }

  && > * + *[data-view='table'] {
    padding: 0;
  }
`;

// Sticky group header; z-index isn't a layout-primitive prop so it lives here.
// Opaque background so cards scroll under it.
const GroupHeader = styled(Sticky)`
  z-index: ${p => p.theme.zIndex.initial + 1};
  align-self: stretch;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};

  &[data-view='table'] {
    border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  }

  &[data-view='table'][data-expanded='false'] {
    border-radius: ${p => p.theme.radius.md};
  }

  &[data-stuck] {
    border-radius: 0;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;
