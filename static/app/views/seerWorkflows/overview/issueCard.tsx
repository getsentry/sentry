import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorLevel} from 'sentry/components/events/errorLevel';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconArrow,
  IconCircleCheckmark,
  IconCommit,
  IconFocus,
  IconMerge,
  IconPullRequest,
  IconSearch,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {ellipsize} from 'sentry/utils/string/ellipsize';

import {ATTENTION_META, AttentionBadge, getAttentionReason} from './attentionBadge';
import {TriggerBadge} from './triggerBadge';
import type {OverviewRow, PatchStats} from './types';

const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

// The most-changed files shown on hover before collapsing into "+N more".
const MAX_TOOLTIP_FILES = 5;

// Per-file breakdown for the diff pill's tooltip: path left, churn right,
// biggest files first (fileList is pre-sorted by churn).
function PatchFilesTooltip({stats}: {stats: PatchStats}) {
  const shown = stats.fileList.slice(0, MAX_TOOLTIP_FILES);
  const hidden = stats.fileList.length - shown.length;
  return (
    <Stack gap="2xs" align="stretch">
      {shown.map(file => (
        <Flex key={file.path} gap="lg" justify="between" align="baseline">
          <Text size="xs" monospace align="left">
            {file.path}
          </Text>
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

// Buckets the raw 0–1 score into a scannable label; the 0.7 threshold matches
// isIssueQuickFixable (sentry/components/events/autofix/utils).
function FixabilityTag({score}: {score: number}) {
  const high = score > 0.7;
  const label = high
    ? t('High fixability')
    : score > 0.4
      ? t('Medium fixability')
      : t('Low fixability');
  return (
    <Tooltip title={t('Fixability score: %s', score.toFixed(2))}>
      <Tag variant={high ? 'success' : 'muted'}>{label}</Tag>
    </Tooltip>
  );
}

export function IssueCard({orgSlug, row}: {orgSlug: string; row: OverviewRow}) {
  const issueUrl = `/organizations/${orgSlug}/issues/${row.id}/`;
  // Deep-link into the issue page with the Seer drawer already open, so the
  // run itself is one click away (matches the issue details ?seerDrawer param).
  const runUrl = {pathname: issueUrl, query: {seerDrawer: 'true'}};
  const attention = getAttentionReason(row);
  // The body shows exactly one block: the proposed fix when the run drafted
  // code (the fix prompt returns an empty answer otherwise, and empty answers
  // never become entries), else the diagnosis summary.
  const summary = row.analysis.find(entry => entry.key === 'summary');
  const proposedFix = row.analysis.find(entry => entry.key === 'fix_summary');
  const bodyEntry = proposedFix ?? summary;
  const isFixBody = bodyEntry?.key === 'fix_summary';
  const detailEntries = row.analysis.filter(entry => entry.placement === 'details');

  const eventCountLabel =
    row.eventCount === 1
      ? t('1 event')
      : t('%s events', formatAbbreviatedNumber(row.eventCount));
  const userCountLabel =
    row.userCount === 1
      ? t('1 user')
      : t('%s users', formatAbbreviatedNumber(row.userCount));

  return (
    <Container background="primary" border="primary" radius="md" padding="lg">
      <Stack gap="md">
        {/* Header: title + change size + action */}
        <Flex justify="between" align="start" gap="md">
          <Flex gap="sm" align="center" minWidth="0" flex="1">
            <ErrorLevel level={row.level} />
            {/* The ellipsis Text is the shrinking flex item (overflow:hidden
                  resolves its min-width to 0); the Link must nest inside it or
                  the anchor refuses to shrink and the title overflows the card.
                  When Seer produced a plain-language headline it replaces the
                  raw issue title, which stays reachable via the tooltip and
                  the expanded details. */}
            <Text bold ellipsis>
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
                  <TitleLink to={issueUrl}>{row.headline}</TitleLink>
                </Tooltip>
              ) : (
                <TitleLink to={issueUrl}>{row.title}</TitleLink>
              )}
            </Text>
          </Flex>
          <Flex gap="sm" align="center" flexShrink={0}>
            {/* No stage chip here: the action verb already encodes the stage
                  (Review PR ⇒ PR opened, Open PR ⇒ code drafted, …) and the
                  Outcome filter covers querying by it. One fact + one action. */}
            {row.patchStats && (
              <Tooltip
                title={<PatchFilesTooltip stats={row.patchStats} />}
                maxWidth={480}
                skipWrapper
              >
                {/* Contained like its Tag/button neighbors so the diff size
                      doesn't read as floating text */}
                <Container
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
            {row.statePending ? (
              <Text variant="muted">{'…'}</Text>
            ) : row.isProcessing ? (
              <Tag variant="info">{t('Running')}</Tag>
            ) : row.prMerged ? (
              <Tooltip title={t('The pull request for this fix was merged.')}>
                <Tag variant="success" icon={<IconMerge />}>
                  {t('Merged')}
                </Tag>
              </Tooltip>
            ) : attention === 'review_pr' && row.prUrl ? (
              <Tooltip
                title={
                  row.prNumber
                    ? t(
                        'Autofix opened pull request #%s. Review and merge it.',
                        row.prNumber
                      )
                    : ATTENTION_META.review_pr.description
                }
                skipWrapper
              >
                <LinkButton
                  size="zero"
                  variant="warning"
                  icon={<IconPullRequest />}
                  href={row.prUrl}
                  external
                >
                  {ATTENTION_META.review_pr.label}
                </LinkButton>
              </Tooltip>
            ) : attention ? (
              <AttentionBadge reason={attention} to={runUrl} />
            ) : (
              <Tooltip title={t('Open the Seer run for this issue.')} skipWrapper>
                <LinkButton size="zero" variant="secondary" to={runUrl}>
                  {t('View run')}
                </LinkButton>
              </Tooltip>
            )}
            {row.prUrl && attention !== 'review_pr' && (
              <LinkButton
                size="zero"
                variant="link"
                icon={<IconPullRequest />}
                href={row.prUrl}
                external
              >
                {row.prNumber ? `#${row.prNumber}` : t('PR')}
              </LinkButton>
            )}
          </Flex>
        </Flex>

        {/* The question autofix is blocked on, surfaced right on the card */}
        {row.pendingQuestion && (
          <Text size="sm" variant="accent">
            {t('Seer asked: %s', row.pendingQuestion)}
          </Text>
        )}

        {/* The body is exactly ONE block, either/or: the proposed fix when the
            run drafted code (the fix text supersedes the summary, which would
            describe the same change twice), otherwise the diagnosis summary.
            Same anatomy for both; icon + label color tell them apart. */}
        {bodyEntry && (
          <Container
            background="secondary"
            border="muted"
            radius="md"
            padding="sm md"
            maxWidth="90ch"
          >
            <Stack gap="xs">
              <Flex gap="xs" align="center">
                {isFixBody ? (
                  <IconCommit size="xs" variant="success" aria-hidden />
                ) : (
                  <IconSearch size="xs" variant="muted" aria-hidden />
                )}
                <Text size="xs" bold uppercase variant={isFixBody ? 'success' : 'muted'}>
                  {isFixBody ? t('Proposed fix') : t('Diagnosis')}
                </Text>
              </Flex>
              <Text size="sm" density="comfortable" as="div">
                <SeerMarkdown raw={bodyEntry.answer} />
              </Text>
            </Stack>
          </Container>
        )}

        {/* Footer: the collapsed analysis on the left, project pinned in the
            card's bottom-right corner */}
        <Flex justify="between" align="start" gap="md" borderTop="muted" paddingTop="sm">
          <Container flex="1" minWidth="0">
            {detailEntries.length > 0 && (
              <Disclosure size="xs">
                <Disclosure.Title>{t('Full analysis')}</Disclosure.Title>
                <Disclosure.Content>
                  <Stack gap="md" paddingTop="xs">
                    {/* Compact identity strip: the short id and Seer's
                        fixability read — the raw title lives in the headline
                        tooltip, not here */}
                    <Flex gap="sm" align="center">
                      <Text size="xs" monospace variant="muted">
                        {row.shortId}
                      </Text>
                      {typeof row.fixabilityScore === 'number' && (
                        <FixabilityTag score={row.fixabilityScore} />
                      )}
                    </Flex>
                    {/* Sections share the body blocks' icon+label voice and
                        sit side by side on wide screens instead of leaving
                        the card's right half empty */}
                    <Grid
                      columns={{xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))'}}
                      gap="lg xl"
                      align="start"
                    >
                      {detailEntries.map(entry => {
                        const section =
                          entry.key === 'reviewer_notes'
                            ? isFixBody
                              ? {
                                  label: t('Review checklist'),
                                  icon: (
                                    <IconCircleCheckmark
                                      size="xs"
                                      variant="muted"
                                      aria-hidden
                                    />
                                  ),
                                }
                              : {
                                  label: t('Next steps'),
                                  icon: (
                                    <IconArrow
                                      direction="right"
                                      size="xs"
                                      variant="muted"
                                      aria-hidden
                                    />
                                  ),
                                }
                            : {
                                label: entry.label,
                                icon: <IconFocus size="xs" variant="muted" aria-hidden />,
                              };
                        return (
                          <Stack key={entry.key} gap="xs">
                            <Flex gap="xs" align="center">
                              {section.icon}
                              <Text size="xs" bold uppercase variant="muted">
                                {section.label}
                              </Text>
                            </Flex>
                            <Text size="sm" density="comfortable" as="div">
                              <SeerMarkdown raw={entry.answer} />
                            </Text>
                          </Stack>
                        );
                      })}
                    </Grid>
                  </Stack>
                </Disclosure.Content>
              </Disclosure>
            )}
          </Container>
          {/* Provenance + vitals read as one quiet metadata line */}
          <Flex gap="md" align="center" flexShrink={0}>
            {/* "Manual" is the default trigger and reads as noise on every
                card; only non-default triggers earn a badge */}
            {row.trigger !== 'manual' && (
              <TriggerBadge trigger={row.trigger} rawSource={row.rawSource} />
            )}
            <Flex gap="xs" align="center">
              <Tooltip
                title={
                  row.userCount > 0
                    ? t(
                        '%s events and %s affected users in the last 90 days',
                        row.eventCount.toLocaleString(),
                        row.userCount.toLocaleString()
                      )
                    : t('%s events in the last 90 days', row.eventCount.toLocaleString())
                }
              >
                <Text size="xs" variant="muted">
                  {eventCountLabel}
                  {row.userCount > 0 && ` · ${userCountLabel}`}
                </Text>
              </Tooltip>
              <Text size="xs" variant="muted" aria-hidden>
                {'·'}
              </Text>
              <Text size="xs" variant="muted" wrap="nowrap">
                <TimeSince
                  date={row.lastActivityAt}
                  prefix={t('updated')}
                  tooltipPrefix={t('Last activity on this Seer run')}
                />
              </Text>
            </Flex>
            <Tooltip title={t('Project')} skipWrapper>
              <ProjectBadge project={row.project} avatarSize={14} disableLink />
            </Tooltip>
          </Flex>
        </Flex>
      </Stack>
    </Container>
  );
}
