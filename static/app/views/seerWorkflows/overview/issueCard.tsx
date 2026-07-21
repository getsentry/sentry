import {useId, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
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
  IconChevron,
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
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import {ATTENTION_META, AttentionBadge, getAttentionReason} from './attentionBadge';
import {StepIndicator} from './stepIndicator';
import {TriggerBadge} from './triggerBadge';
import type {OverviewRow, PatchStats} from './types';

const TitleLink = styled(Link)`
  color: inherit;
  &:hover {
    color: inherit;
    text-decoration: underline;
  }
`;

// The "More details" trigger stretches across its row so the whole tail of
// the card is a click target (label pinned left), shedding the Button's
// horizontal padding to sit flush with the rows above. (Not core Disclosure:
// the trigger anchors the bottom row while the analysis expands as a
// separate full-width block below.)
const AnalysisToggle = styled(Button)`
  width: 100%;
  justify-content: flex-start;
  padding-left: 0;
  padding-right: 0;
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

export function IssueCard({
  orgSlug,
  row,
  defaultExpanded = false,
}: {
  orgSlug: string;
  row: OverviewRow;
  // Open every collapsible (More details, inline diffs) on mount — the
  // overview's ?id= focus mode wants the whole card readable at once.
  defaultExpanded?: boolean;
}) {
  const issueUrl = `/organizations/${orgSlug}/issues/${row.id}/`;
  // Deep-link into the issue page with the Seer drawer already open, so the
  // run itself is one click away (matches the issue details ?seerDrawer param).
  const runUrl = {pathname: issueUrl, query: {seerDrawer: 'true'}};
  const attention = getAttentionReason(row);
  // The body leads with one block: the proposed fix when the run drafted
  // code (the fix prompt returns an empty answer otherwise, and empty answers
  // never become entries), else the diagnosis summary.
  const summary = row.analysis.find(entry => entry.key === 'summary');
  const proposedFix = row.analysis.find(entry => entry.key === 'fix_summary');
  const bodyEntry = proposedFix ?? summary;
  const isFixBody = bodyEntry?.key === 'fix_summary';
  // Without drafted code, the reviewer notes ARE the human's to-do — promote
  // them onto the card face as their own block. With a fix they stay in the
  // details as the review checklist (the fix body dominates that card).
  const nextSteps = isFixBody
    ? undefined
    : row.analysis.find(entry => entry.key === 'reviewer_notes');
  const detailEntries = row.analysis.filter(
    entry => entry.placement === 'details' && entry !== nextSteps
  );
  const [analysisExpanded, setAnalysisExpanded] = useState(defaultExpanded);
  const analysisId = useId();

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
        {/* Header: ring + (title over its metadata subline) on the left,
            change size / action pinned right */}
        <Flex justify="between" align="start" gap="md">
          <Flex gap="md" align="center" minWidth="0" flex="1">
            <StepIndicator row={row} />
            <Stack gap="2xs" minWidth="0" flex="1">
              {/* The ellipsis Text is the shrinking flex item (overflow:hidden
                  resolves its min-width to 0); the Link must nest inside it or
                  the anchor refuses to shrink and the title overflows the card.
                  When Seer produced a plain-language headline it replaces the
                  raw issue title, which stays reachable via the tooltip and
                  the expanded details. */}
              {/* lg matches the issues feed's row titles */}
              <Text bold ellipsis size="lg">
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
              {/* Metadata subline: the run's vitals as a quiet dot-separated
                  run tucked under the title. "Manual" is the default trigger
                  and reads as noise on every card, so only non-default
                  triggers earn their badge. */}
              <Flex gap="sm" align="center" wrap="wrap">
                <Tooltip
                  title={
                    row.userCount > 0
                      ? t(
                          '%s events and %s affected users in the last 90 days',
                          row.eventCount.toLocaleString(),
                          row.userCount.toLocaleString()
                        )
                      : t(
                          '%s events in the last 90 days',
                          row.eventCount.toLocaleString()
                        )
                  }
                >
                  <Text size="sm" variant="muted">
                    {eventCountLabel}
                    {row.userCount > 0 && ` · ${userCountLabel}`}
                  </Text>
                </Tooltip>
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
          </Flex>
          <Flex gap="sm" align="center" flexShrink={0}>
            {/* No stage chip here: the step indicator up front carries the
                  stage, the action verb carries what to do about it (Review
                  PR ⇒ PR opened, Open PR ⇒ code drafted, …). */}
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
                  size="sm"
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
                <LinkButton size="sm" variant="secondary" to={runUrl}>
                  {t('View run')}
                </LinkButton>
              </Tooltip>
            )}
            {row.prUrl && attention !== 'review_pr' && (
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
        </Flex>

        {/* The question autofix is blocked on, surfaced right on the card */}
        {row.pendingQuestion && (
          <Text size="md" variant="accent">
            {t('Seer asked: %s', row.pendingQuestion)}
          </Text>
        )}

        {/* The body leads with ONE block, either/or: the proposed fix when
            the run drafted code (the fix text supersedes the summary, which
            would describe the same change twice), otherwise the diagnosis
            summary. Same anatomy for both; icon + label color tell them
            apart. */}
        {bodyEntry && (
          <Container background="secondary" border="muted" radius="md" padding="sm md">
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
              <Text size="md" density="comfortable" as="div">
                <SeerMarkdown raw={bodyEntry.answer} />
              </Text>
            </Stack>
          </Container>
        )}

        {/* The human's to-do, promoted onto the face when no code was
            drafted — same quiet anatomy as the diagnosis block above it. */}
        {nextSteps && (
          <Container background="secondary" border="muted" radius="md" padding="sm md">
            <Stack gap="xs">
              <Flex gap="xs" align="center">
                <IconArrow direction="right" size="xs" variant="muted" aria-hidden />
                <Text size="xs" bold uppercase variant="muted">
                  {t('Next steps')}
                </Text>
              </Flex>
              <Text size="md" density="comfortable" as="div">
                <SeerMarkdown raw={nextSteps.answer} />
              </Text>
            </Stack>
          </Container>
        )}

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

        {/* Bottom row: the analysis toggle stretches across the card's tail
            (whole row toggles), project provenance inline at the right,
            linking to its project page */}
        <Flex justify="between" align="center" gap="md">
          <Container flex="1" minWidth="0">
            {detailEntries.length > 0 && (
              <AnalysisToggle
                size="xs"
                variant="transparent"
                icon={
                  <IconChevron
                    direction={analysisExpanded ? 'down' : 'right'}
                    size="xs"
                  />
                }
                aria-expanded={analysisExpanded}
                aria-controls={analysisId}
                onClick={() => setAnalysisExpanded(expanded => !expanded)}
              >
                {t('More details')}
              </AnalysisToggle>
            )}
          </Container>
          <Tooltip title={t('View project')} skipWrapper>
            <ProjectBadge project={row.project} avatarSize={14} />
          </Tooltip>
        </Flex>

        {/* The expanded analysis is its own full-width block (rather than
            nested under the toggle) so the two-column grid gets the whole
            card width */}
        {analysisExpanded && detailEntries.length > 0 && (
          <Stack gap="md" id={analysisId} borderTop="muted" paddingTop="sm">
            {/* Compact identity strip: the level and short id — the raw
                title lives in the headline tooltip, not here */}
            <Flex gap="sm" align="center">
              <ErrorLevel level={row.level} />
              <Text size="xs" monospace variant="muted">
                {row.shortId}
              </Text>
            </Flex>
            {/* Sections share the body blocks' icon+label voice and sit side
                by side on wide screens instead of leaving the card's right
                half empty */}
            <Grid
              columns={{xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))'}}
              gap="lg xl"
              align="start"
            >
              {detailEntries.map(entry => {
                // reviewer_notes only reaches the details when code was
                // drafted — the no-code case is promoted onto the card face
                // as the Next-steps block.
                const section =
                  entry.key === 'reviewer_notes'
                    ? {
                        label: t('Review checklist'),
                        icon: (
                          <IconCircleCheckmark size="xs" variant="muted" aria-hidden />
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
                    <Text size="md" density="comfortable" as="div">
                      <SeerMarkdown raw={entry.answer} />
                    </Text>
                  </Stack>
                );
              })}
            </Grid>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
