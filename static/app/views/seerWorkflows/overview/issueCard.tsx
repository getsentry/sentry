import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {TimeSince} from 'sentry/components/timeSince';
import {IconArrow, IconCommit, IconFocus, IconPullRequest} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import {deriveCardAction, IssuePrimaryAction} from './cardAction';
import {periodWindowLabel} from './periods';
import {TriggerBadge} from './triggerBadge';
import type {AutofixStateKey, OverviewRow, PatchStats} from './types';

const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

// The most-changed files shown on hover before collapsing into "+N more".
const MAX_TOOLTIP_FILES = 5;

// Paths have no spaces to wrap on, so a long one would push the +/− counts
// out of the tooltip's max width. Truncate from the LEFT (rtl trick, like the
// diff viewer's file header) so the filename end stays visible; overflow
// hidden also gives the flex item its min-width of 0.
const TooltipPath = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
`;

// Per-file breakdown for the diff pill's tooltip: path left, churn right,
// biggest files first (fileList is pre-sorted by churn).
function PatchFilesTooltip({stats}: {stats: PatchStats}) {
  const shown = stats.fileList.slice(0, MAX_TOOLTIP_FILES);
  const hidden = stats.fileList.length - shown.length;
  return (
    <Stack gap="2xs" align="stretch">
      {shown.map(file => (
        <Flex key={file.path} gap="lg" justify="between" align="baseline">
          <TooltipPath size="xs" monospace>
            {file.path}
          </TooltipPath>
          <Text size="xs" monospace wrap="nowrap">
            <Text size="xs" variant="success">
              +{file.added}
            </Text>{' '}
            <Text size="xs" variant="danger">
              −{file.removed}
            </Text>
          </Text>
        </Flex>
      ))}
      {hidden > 0 && (
        <Text size="xs" variant="muted" align="left">
          {tn('+%s more file', '+%s more files', hidden)}
        </Text>
      )}
    </Stack>
  );
}

function issueCountLabels(row: OverviewRow) {
  return {
    eventCountLabel:
      row.eventCount === 1
        ? t('1 event')
        : t('%s events', formatAbbreviatedNumber(row.eventCount)),
    userCountLabel:
      row.userCount === 1
        ? t('1 user')
        : t('%s users', formatAbbreviatedNumber(row.userCount)),
  };
}

function IssueTitleLink({row, to, size}: {row: OverviewRow; to: string; size?: 'lg'}) {
  // The ellipsis Text is the shrinking flex item (overflow:hidden resolves its
  // min-width to 0); the Link must nest inside it or the anchor refuses to
  // shrink and the title overflows the card. When Seer produced a
  // plain-language headline it replaces the raw issue title, which stays
  // reachable via the tooltip and the expanded details.
  return (
    <Text bold ellipsis size={size}>
      {row.headline ? (
        <Tooltip
          maxWidth={480}
          title={
            <Stack gap="2xs">
              <Text size="xs" bold uppercase variant="muted" align="left">
                {t('Raw issue title')}
              </Text>
              <Text size="xs" align="left">
                {ellipsize(row.title, 200)}
              </Text>
            </Stack>
          }
        >
          <TitleLink to={to}>{row.headline}</TitleLink>
        </Tooltip>
      ) : (
        <TitleLink to={to}>{row.title}</TitleLink>
      )}
    </Text>
  );
}

export function IssueCard({
  orgSlug,
  row,
  sectionKey,
  defaultExpanded = false,
  minHeight,
}: {
  orgSlug: string;
  row: OverviewRow;
  sectionKey: AutofixStateKey;
  // Open the inline diffs on mount — the overview's ?id= focus mode wants
  // the whole card readable at once.
  defaultExpanded?: boolean;
  minHeight?: string;
}) {
  const issueUrl = `/organizations/${orgSlug}/issues/${row.id}/`;
  // Deep-link into the issue page with the Seer drawer already open, so the
  // run itself is one click away (matches the issue details ?seerDrawer param).
  const runUrl = {pathname: issueUrl, query: {seerDrawer: 'true'}};
  const cardAction = deriveCardAction(sectionKey, row);
  const rootCause = row.analysis.find(entry => entry.key === 'root_cause');
  const proposedFix = row.analysis.find(entry => entry.key === 'fix_summary');
  const nextSteps = row.analysis.find(entry => entry.key === 'next_steps');

  // Thought order: what broke → what Seer changed → what the human does
  // next. The fix and next-step prompts return empty answers when they don't
  // apply, and empty answers never become entries.
  const sections = [
    rootCause && {
      key: 'root_cause',
      label: t('Root cause'),
      icon: <IconFocus size="xs" variant="muted" aria-hidden />,
      variant: 'muted' as const,
      answer: rootCause.answer,
    },
    proposedFix && {
      key: 'fix_summary',
      label: t('Proposed fix'),
      icon: <IconCommit size="xs" variant="success" aria-hidden />,
      variant: 'success' as const,
      answer: proposedFix.answer,
    },
    nextSteps && {
      key: 'next_steps',
      label: t('Next steps'),
      icon: <IconArrow direction="right" size="xs" variant="muted" aria-hidden />,
      variant: 'muted' as const,
      answer: nextSteps.answer,
    },
  ].filter(section => !!section);
  const {eventCountLabel, userCountLabel} = issueCountLabels(row);

  return (
    <Container
      background="primary"
      border="primary"
      radius="md"
      padding="lg"
      minHeight={minHeight}
    >
      <Stack gap="lg">
        {/* Header: title over metadata subline, diff size pinned right */}
        <Flex justify="between" align="start" gap="md">
          <Stack gap="2xs" minWidth="0" flex="1">
            {/* lg matches the issues feed's row titles */}
            <IssueTitleLink row={row} to={issueUrl} size="lg" />
            {/* Only non-default triggers get a badge; "manual" is the default. */}
            <Flex gap="sm" align="center" wrap="wrap">
              <InfoText
                title={
                  row.userCount > 0
                    ? t(
                        '%s events and %s affected users %s',
                        row.eventCount.toLocaleString(),
                        row.userCount.toLocaleString(),
                        periodWindowLabel(row.statsPeriod)
                      )
                    : t(
                        '%s events %s',
                        row.eventCount.toLocaleString(),
                        periodWindowLabel(row.statsPeriod)
                      )
                }
                size="sm"
                variant="muted"
              >
                {eventCountLabel}
                {row.userCount > 0 && ` · ${userCountLabel}`}
              </InfoText>
              <Text size="sm" variant="muted" aria-hidden>
                {'·'}
              </Text>
              <Text size="sm" variant="muted" wrap="nowrap">
                <TimeSince
                  date={row.lastActivityAt}
                  prefix={t('updated')}
                  tooltipPrefix={t('Last activity on this Seer run')}
                />
              </Text>
              {row.trigger !== 'manual' && (
                <TriggerBadge trigger={row.trigger} rawSource={row.rawSource} />
              )}
            </Flex>
          </Stack>
          {/* Right cluster: just the diff-size fact — the action lives in
              the card's tail, the pipeline story on the group header */}
          <Flex gap="sm" align="center" flexShrink={0}>
            {row.patchStats && (
              <Tooltip
                title={<PatchFilesTooltip stats={row.patchStats} />}
                maxWidth={480}
                skipWrapper
              >
                <Container
                  tabIndex={0}
                  aria-label={tn(
                    '%s file changed',
                    '%s files changed',
                    row.patchStats.files
                  )}
                  border="muted"
                  radius="sm"
                  background="secondary"
                  padding="2xs sm"
                >
                  <Text size="xs" variant="muted" monospace wrap="nowrap">
                    {tn('%s file', '%s files', row.patchStats.files)}{' '}
                    <Text size="xs" variant="success">
                      +{row.patchStats.added}
                    </Text>{' '}
                    <Text size="xs" variant="danger">
                      −{row.patchStats.removed}
                    </Text>
                  </Text>
                </Container>
              </Tooltip>
            )}
          </Flex>
        </Flex>

        {/* The question autofix is blocked on, surfaced right on the card */}
        {row.pendingQuestion && (
          <Text size="md" variant="accent">
            {t('Seer asked: %s', row.pendingQuestion)}
          </Text>
        )}

        {/* The analysis sections, one shared voice (eyebrow icon +
            uppercase label + prose), in thought order */}
        {sections.map(section => (
          <Stack key={section.key} gap="xs">
            <Flex gap="xs" align="center">
              {section.icon}
              <Text size="xs" bold uppercase variant={section.variant}>
                {section.label}
              </Text>
            </Flex>
            <Text size="md" density="comfortable" as="div">
              <SeerMarkdown raw={section.answer} />
            </Text>
          </Stack>
        ))}

        {/* The drafted diff itself, but only when it's small enough to read
            on a card (see the INLINE_DIFF_* limits): collapsed file headers
            that expand in place, aligned with the body's text column */}
        {row.inlinePatches && (
          <Stack gap="xs">
            {row.inlinePatches.map(({patch, repoName}) => (
              <FileDiffViewer
                key={`${repoName ?? ''}:${patch.path}`}
                patch={patch}
                repoName={repoName}
                collapsible
                defaultExpanded={defaultExpanded}
                showBorder
              />
            ))}
          </Stack>
        )}

        {/* Tail: primary action left, issue identity right */}
        <Flex justify="between" align="center" gap="md">
          <Flex gap="sm" align="center">
            <IssuePrimaryAction action={cardAction} row={row} runUrl={runUrl} />
            {row.prUrl && cardAction.type !== 'review_pr' && (
              <LinkButton
                size="sm"
                variant="link"
                icon={<IconPullRequest />}
                href={row.prUrl}
                external
              >
                {row.prNumber ? `#${row.prNumber}` : t('PR')}
              </LinkButton>
            )}
          </Flex>
          <Flex gap="sm" align="center" flexShrink={0}>
            <ErrorLevel level={row.level} />
            <Text size="xs" monospace variant="muted">
              {row.shortId}
            </Text>
            <Tooltip title={t('View project')} skipWrapper>
              <ProjectBadge project={row.project} avatarSize={14} />
            </Tooltip>
          </Flex>
        </Flex>
      </Stack>
    </Container>
  );
}

/**
 * The compact, Linear-style rendering used by the overview's table mode.
 * Keep this deliberately sparse: the full analysis and diff stay in card
 * mode, while this row is optimized for scanning and taking the next action.
 */
export function IssueTableRow({
  orgSlug,
  row,
  sectionKey,
  minHeight,
}: {
  orgSlug: string;
  row: OverviewRow;
  sectionKey: AutofixStateKey;
  minHeight?: string;
}) {
  const issueUrl = `/organizations/${orgSlug}/issues/${row.id}/`;
  const runUrl = {pathname: issueUrl, query: {seerDrawer: 'true'}};
  const cardAction = deriveCardAction(sectionKey, row);
  const {eventCountLabel, userCountLabel} = issueCountLabels(row);

  return (
    <Flex
      justify="between"
      align="center"
      gap="lg"
      padding="md lg"
      borderBottom="primary"
      minHeight={minHeight}
    >
      <Stack gap="2xs" minWidth="0" flex="1">
        <IssueTitleLink row={row} to={issueUrl} />
        <Flex gap="xs" align="center" wrap="wrap">
          <ProjectBadge project={row.project} avatarSize={14} hideName />
          <Text size="sm" variant="muted" monospace wrap="nowrap">
            {row.shortId}
          </Text>
          <Text size="sm" variant="muted" aria-hidden>
            {'·'}
          </Text>
          <Text size="sm" variant="muted" wrap="nowrap">
            {eventCountLabel}
            {row.userCount > 0 && ` · ${userCountLabel}`}
          </Text>
          <Text size="sm" variant="muted" aria-hidden>
            {'·'}
          </Text>
          <Text size="sm" variant="muted" wrap="nowrap">
            <TimeSince
              date={row.lastActivityAt}
              prefix={t('updated')}
              tooltipPrefix={t('Last activity on this Seer run')}
            />
          </Text>
        </Flex>
      </Stack>
      <Flex align="center" flexShrink={0}>
        <IssuePrimaryAction action={cardAction} row={row} runUrl={runUrl} />
      </Flex>
    </Flex>
  );
}
