import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Collapsible} from 'sentry/components/collapsible';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Sticky} from 'sentry/components/sticky';
import {t, tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SectionIssueCard} from './sectionIssueCard';
import {
  STATUS_GROUP_META,
  StatusGroupTooltip,
  type StatusGroupKey,
} from './statusGroups';
import type {OverviewView, SortValue} from './types';
import {useAutofixSections} from './useAutofixSections';

// Each rendered card mounts two live enrichment queries, so cap how many hydrate
// per section and reveal the rest on demand — the header badge keeps the true
// total. Unrevealed cards stay unmounted (Collapsible slices before rendering).
const SECTION_RENDER_CAP = 25;

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
    section => !section.isPending && section.issues.length === 0
  );

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
          {t('No completed autofix runs yet.')}
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
                  <Badge variant="muted">{section.count ?? '…'}</Badge>
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
                <Stack gap={view === 'cards' ? 'md' : '0'} paddingTop="sm">
                  <Collapsible
                    maxVisibleItems={SECTION_RENDER_CAP}
                    expandButton={({onExpand, numberOfHiddenItems}) => (
                      <Button size="sm" variant="link" onClick={onExpand}>
                        {tn(
                          'Show %s more issue',
                          'Show %s more issues',
                          numberOfHiddenItems
                        )}
                      </Button>
                    )}
                    collapseButton={({onCollapse}) => (
                      <Button size="sm" variant="link" onClick={onCollapse}>
                        {t('Show less')}
                      </Button>
                    )}
                  >
                    {section.issues.map((issue, index) => (
                      <SectionIssueCard
                        key={issue.id}
                        issue={issue}
                        orgSlug={organization.slug}
                        sectionKey={section.key}
                        view={view}
                        statsPeriod={period}
                        isLast={index === section.issues.length - 1}
                      />
                    ))}
                  </Collapsible>
                </Stack>
              )}
            </Disclosure.Content>
          </StatusGroup>
        );
      })}
    </Stack>
  );
}

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
