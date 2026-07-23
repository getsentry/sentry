import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Sticky} from 'sentry/components/sticky';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

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
}) {
  const organization = useOrganization();
  const {sections, isPending, isError, refetch} = useAutofixSections({
    enabled,
    projects,
    sort: sort === 'events' ? 'freq' : 'date',
    statsPeriod: period,
  });

  const firstLoad = isPending && sections.every(section => section.isPending);
  const allSectionsEmpty = sections.every(
    section => !section.isPending && !section.isError && section.issues.length === 0
  );
  const hasNonDefaultFilters = projects.length > 0 || period !== DEFAULT_STATS_PERIOD;

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
        return (
          <StatusGroup
            key={section.key}
            size="sm"
            expanded={!collapsedGroups.includes(section.key)}
            onExpandedChange={next => onToggleGroup(section.key, next)}
          >
            <GroupHeader>
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
            <Disclosure.Content>
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
                  paddingTop="sm"
                  data-view={view}
                >
                  {section.issues.map(issue => (
                    <SectionIssueCard
                      key={issue.id}
                      issue={issue}
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

// Disclosure.Content hardcodes a padding-left to indent its panel under the
// title; the `> * + *` sibling selector drops it so the full-width cards line
// up flush with their group header.
const StatusGroup = styled(Disclosure)`
  && > * + * {
    padding-left: 0;
  }
`;

// Sticky group header; z-index isn't a layout-primitive prop so it lives here.
// Opaque background so cards scroll under it.
const GroupHeader = styled(Sticky)`
  z-index: ${p => p.theme.zIndex.initial};
  width: 100%;
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};

  &[data-stuck] {
    border-radius: 0;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;
