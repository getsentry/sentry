import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
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
  IconClock,
  IconCommit,
  IconFocus,
  IconGraph,
  IconPullRequest,
  IconSeer,
  IconUser,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {ellipsize} from 'sentry/utils/string/ellipsize';

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

// ErrorLevel's colored line stretched from its 1em inline size into an accent
// bar spanning the full title block (its grid cell stretches it).
const LevelBar = styled(ErrorLevel)`
  height: auto;
  width: 4px;
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

// One icon-prefixed item in the metadata subline. The icon stands in for a
// text label, so each item needs a tooltip carrying its meaning — TimeSince
// children bring their own.
function MetaItem({
  children,
  icon,
  tooltip,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tooltip?: React.ReactNode;
}) {
  const item = (
    // minWidth 0 + ellipsis let the item truncate inside a tight rail column
    // instead of pushing the layout wider.
    <Flex gap="xs" align="center" minWidth="0">
      {icon}
      <Text size="sm" variant="muted" ellipsis>
        {children}
      </Text>
    </Flex>
  );
  return tooltip ? (
    <Tooltip title={tooltip} skipWrapper>
      {item}
    </Tooltip>
  ) : (
    item
  );
}

// The issue/run vitals shared by the card's rail and the table subline:
// counts, then issue recency (when it last fired), then Seer recency (when
// Seer last touched the run). Renders a Fragment, so the parent decides the
// axis — stacked in the card rail, inline in the table row.
function IssueVitals({row}: {row: OverviewRow}) {
  const eventCountLabel =
    row.eventCount === 1
      ? t('1 event')
      : t('%s events', formatAbbreviatedNumber(row.eventCount));
  const userCountLabel =
    row.userCount === 1
      ? t('1 user')
      : t('%s users', formatAbbreviatedNumber(row.userCount));
  return (
    <Fragment>
      <MetaItem
        icon={<IconGraph size="xs" variant="muted" aria-hidden />}
        tooltip={t(
          '%s events %s',
          row.eventCount.toLocaleString(),
          periodWindowLabel(row.statsPeriod)
        )}
      >
        {eventCountLabel}
      </MetaItem>
      {row.userCount > 0 && (
        <MetaItem
          icon={<IconUser size="xs" variant="muted" aria-hidden />}
          tooltip={t(
            '%s affected users %s',
            row.userCount.toLocaleString(),
            periodWindowLabel(row.statsPeriod)
          )}
        >
          {userCountLabel}
        </MetaItem>
      )}
      <MetaItem icon={<IconClock size="xs" variant="muted" aria-hidden />}>
        <TimeSince
          date={row.lastSeen}
          tooltipPrefix={t('The most recent event in this issue occurred')}
        />
      </MetaItem>
      {row.lastActivityAt && (
        <MetaItem icon={<IconSeer size="xs" variant="muted" aria-hidden />}>
          <TimeSince
            date={row.lastActivityAt}
            tooltipPrefix={t('Last activity on this Seer run')}
          />
        </MetaItem>
      )}
    </Fragment>
  );
}

function IssueTitleLink({
  row,
  to,
  size,
  ellipsis = true,
}: {
  row: OverviewRow;
  to: string;
  // Table rows truncate for density; cards pass false so titles always wrap
  // instead of getting cut off.
  ellipsis?: boolean;
  size?: React.ComponentProps<typeof Text>['size'];
}) {
  // Card mode: the headline wraps freely (explicit block display — a
  // non-ellipsis Text is otherwise a native inline span whose line boxes
  // escape the title row's geometry), and the raw issue title reads as a
  // quiet single-line subheader beneath it instead of hiding in a tooltip.
  if (!ellipsis) {
    return (
      <Stack gap="2xs" minWidth="0">
        <Text bold display="block" textWrap="pretty" size={size}>
          <TitleLink to={to}>{row.headline ?? row.title}</TitleLink>
        </Text>
        {row.headline && (
          // The raw title is provenance, not reading material: one muted
          // truncated line — the full string lives on the issue page.
          <Text size="sm" variant="muted" ellipsis title={row.title}>
            {row.title}
          </Text>
        )}
      </Stack>
    );
  }

  // Table mode: one truncated line for density (overflow:hidden resolves the
  // Text's flex min-width to 0; the Link must nest inside it or the anchor
  // refuses to shrink and the title overflows the row). The raw title stays
  // in a tooltip here — there's no room for a subheader. skipWrapper is
  // load-bearing: the default tooltip wrapper is an inline-block, an atomic
  // inline whose baseline anchors to its LAST line and breaks truncation.
  return (
    <Text bold ellipsis size={size}>
      {row.headline ? (
        <Tooltip
          skipWrapper
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
  minHeight,
}: {
  orgSlug: string;
  row: OverviewRow;
  sectionKey: AutofixStateKey;
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

  return (
    // inline-size makes the card a query container: the bare responsive keys
    // below reflow on the CARD's width (sidebar, split windows), not the
    // viewport's.
    <Container
      background="primary"
      border="primary"
      radius="md"
      padding="xl"
      minHeight={minHeight}
      containerType="inline-size"
    >
      <Stack gap="lg">
        {/* Two-column region: the narrative on the left, an identity + action
            rail on the right. Narrow cards stack, rail first — it holds the
            identity and the action, which lead on wide cards too. */}
        {/* align: start is vertical in row mode, but horizontal once the card
            stacks — there it must be stretch or the children shrink to
            content width and long code tokens push past the card edge. */}
        {/* 3xl gutter: the narrative gives up width so the prose never
            crowds the rail; xs keeps the tighter vertical gap when the
            regions stack. */}
        <Flex
          gap={{xs: 'xl', sm: '3xl'}}
          align={{xs: 'stretch', sm: 'start'}}
          justify="between"
          direction={{xs: 'column-reverse', sm: 'row'}}
        >
          {/* Left: what broke → what Seer changed → what the human does next.
              The fixed rail pins the right edge; the grid below decides how
              the prose uses the rest. */}
          <Stack gap="lg" minWidth="0" flex="1">
            {/* Grid, not flex: grid items stretch by default, so the level
                bar spans every wrapped title line and the text cell can't
                escape the row */}
            <Grid columns="max-content minmax(0, 1fr)" gap="sm">
              <LevelBar level={row.level} />
              {/* lg matches the issues feed's row titles */}
              <IssueTitleLink row={row} to={issueUrl} size="lg" ellipsis={false} />
            </Grid>

            {/* The question autofix is blocked on, surfaced right on the card */}
            {row.pendingQuestion && (
              <Text size="md" variant="accent">
                {t('Seer asked: %s', row.pendingQuestion)}
              </Text>
            )}

            {/* The analysis sections, one shared voice (eyebrow icon +
                uppercase label + prose), in thought order — side by side when
                the card is wide enough for two readable columns */}
            <Grid
              columns={
                // Two-up only when the card is genuinely wide — two cramped
                // columns read worse than one full-width stack.
                sections.length > 1 ? {xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))'} : '1fr'
              }
              gap="lg 2xl"
              align="start"
            >
              {sections.map(section => (
                <Stack key={section.key} gap="xs" maxWidth="70ch">
                  <Flex gap="xs" align="center">
                    {section.icon}
                    <Text size="xs" bold uppercase variant={section.variant}>
                      {section.label}
                    </Text>
                  </Flex>
                  {/* break-word keeps unbreakable code tokens (long file
                      paths) from forcing the column wider than the card */}
                  <Text
                    size={{xs: 'md', lg: 'lg'}}
                    density="comfortable"
                    wordBreak="break-word"
                    as="div"
                  >
                    <SeerMarkdown raw={section.answer} />
                  </Text>
                </Stack>
              ))}
            </Grid>
          </Stack>

          {/* Right rail: issue identity and vitals, then the action column.
              The rail width is FIXED so every card's rail — and therefore
              every card's narrative width and analysis columns — starts at
              the same x. Inside, a grid gives the action column its natural
              size and lets the vitals column shrink (minmax(0,1fr)) with
              truncating text, so oversized content can never push past the
              card edge. Full-width band above the narrative on narrow
              cards. */}
          {/* 380px: a full-width Review PR button (~210px) + gap still
              leaves the vitals column ~130px, enough for the longest
              shortIds before the ellipsis kicks in. */}
          <Grid
            columns="minmax(0, 1fr) auto"
            gap="xl"
            align="start"
            flexShrink={0}
            width={{xs: '100%', sm: '380px'}}
          >
            <Stack
              gap={{xs: 'md', sm: 'xs'}}
              direction={{xs: 'row', sm: 'column'}}
              wrap="wrap"
              minWidth="0"
            >
              <Flex gap="xs" align="center" minWidth="0">
                <Tooltip title={t('View project')} skipWrapper>
                  <ProjectBadge project={row.project} avatarSize={14} hideName />
                </Tooltip>
                <Text size="sm" monospace variant="muted" ellipsis>
                  {row.shortId}
                </Text>
              </Flex>
              <IssueVitals row={row} />
              {/* Only non-default triggers get a badge; "manual" is the default. */}
              {row.trigger !== 'manual' && (
                <TriggerBadge trigger={row.trigger} rawSource={row.rawSource} />
              )}
            </Stack>
            <Stack gap="xs" align="end">
              <IssuePrimaryAction action={cardAction} row={row} runUrl={runUrl} />
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
            </Stack>
          </Grid>
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
        <Flex gap="md" align="center" wrap="wrap">
          <Flex gap="xs" align="center">
            <ProjectBadge project={row.project} avatarSize={14} hideName />
            <Text size="sm" variant="muted" monospace wrap="nowrap">
              {row.shortId}
            </Text>
          </Flex>
          <IssueVitals row={row} />
        </Flex>
      </Stack>
      <Flex align="center" flexShrink={0}>
        <IssuePrimaryAction action={cardAction} row={row} runUrl={runUrl} size="xs" />
      </Flex>
    </Flex>
  );
}
