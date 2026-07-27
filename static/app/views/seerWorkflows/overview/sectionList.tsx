import {useMemo} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Badge} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Sticky} from 'sentry/components/sticky';
import {t} from 'sentry/locale';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {indexMembersByProject} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {DEFAULT_STATS_PERIOD} from './periods';
import {SectionIssueCard} from './sectionIssueCard';
import {STATUS_GROUP_META, StatusGroupTooltip, type StatusGroupKey} from './statusGroups';
import type {OverviewView, SortValue} from './types';
import {SECTION_LIMIT, useAutofixSections} from './useAutofixSections';

function formatSectionCount(count: number | undefined) {
  if (count === undefined) {
    return '…';
  }
  return count > SECTION_LIMIT ? `${SECTION_LIMIT}+` : count;
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
  const memberQuery = useQuery({
    ...useProjectMembersQueryOptions(memberProjectIds),
    select: response => indexMembersByProject(response.json),
    enabled: enabled && hasCardIssues,
  });

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
            <Disclosure.Content data-view={view}>
              {section.isError ? (
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
                <SectionRows
                  gap={view === 'cards' ? 'md' : '0'}
                  paddingTop={view === 'cards' ? 'sm' : '0'}
                  data-view={view}
                >
                  {section.issues.map(issue => (
                    <SectionIssueCard
                      key={issue.id}
                      issue={issue}
                      memberList={
                        memberQuery.isError
                          ? undefined
                          : (memberQuery.data?.get(issue.project.slug) ?? [])
                      }
                      memberListLoading={memberQuery.isPending}
                      orgSlug={organization.slug}
                      sectionKey={section.key}
                      view={view}
                      statsPeriod={period}
                    />
                  ))}
                </SectionRows>
              )}
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
