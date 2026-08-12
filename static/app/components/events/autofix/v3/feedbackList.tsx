import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LetterAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  isPrIterationBlock,
  type AutofixSection,
  type RawFeedback,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCircle} from 'sentry/icons/iconCircle';
import {IconCircleCheckmark} from 'sentry/icons/iconCircleCheckmark';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import type {AvatarUser, User} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {userDisplayName} from 'sentry/utils/formatters';

const AVATAR_SIZE = 24;
const SOURCE_BADGE_SIZE = 14;

/**
 * - `processed`: the iteration it drove has finished and its changes are pushed.
 * - `in_progress`: it's driving the iteration currently being processed.
 * - `queued`: submitted while a run was processing, not yet picked up.
 */
type FeedbackStatus = 'processed' | 'in_progress' | 'queued';

interface ParsedBaseFeedback {
  text: string;
  timestamp?: string;
}

interface UserUiFeedback extends ParsedBaseFeedback {
  sourceType: 'user-ui';
  user?: User | null;
}

interface GithubPrCommentFeedback extends ParsedBaseFeedback {
  commentUrl: string;
  sourceType: 'github-pr-comment';
  githubUsername?: string;
}

// An inline comment left as part of a submitted review.
interface GithubPrReviewCommentFeedback extends Omit<
  GithubPrCommentFeedback,
  'sourceType'
> {
  sourceType: 'github-pr-review-comment';
  // Shared with the review body's `reviewId` to group a review's items under one
  // header.
  reviewId?: number;
}

// The summary body of a submitted PR review: carries the review-level
// `reviewState` and heads a group of the review's inline comments.
interface GithubPrReviewBodyFeedback extends ParsedBaseFeedback {
  sourceType: 'github-pr-review-body';
  // Absent on feedback serialized before the backend emitted it; the header then
  // falls back to the source glyph.
  githubUsername?: string;
  reviewId?: number;
  reviewState?: string;
  reviewUrl?: string;
}

interface CheckSuiteFeedback extends ParsedBaseFeedback {
  checkSuiteUrl: string;
  sourceType: 'check-suite';
}
interface OtherFeedback extends ParsedBaseFeedback {
  source: string;
  sourceType: 'other';
}

// What `parseFeedback` can produce from the stored JSON alone.
type ParsedFeedback =
  | UserUiFeedback
  | GithubPrCommentFeedback
  | GithubPrReviewCommentFeedback
  | GithubPrReviewBodyFeedback
  | CheckSuiteFeedback
  | OtherFeedback;

// A parsed feedback enriched with the iteration context the caller supplies.
type IterationFeedback = ParsedFeedback & {
  iterationIndex: number;
  status: FeedbackStatus;
};

function parseFeedbackItem(parsed: RawFeedback): ParsedFeedback | null {
  // `ui_text` is the short display label the backend derives per source; fall
  // back to the raw prompt `text` for feedback serialized before it existed.
  const base = {
    text: parsed.ui_text ?? parsed.text,
    timestamp: parsed.timestamp,
  };
  const source = parsed.source;
  switch (source?.type) {
    case 'user-ui':
      return {...base, sourceType: 'user-ui', user: source.user};
    case 'github-pr-comment':
    case 'github-pr-review-comment': {
      const commentUrl = source.comment?.html_url;
      if (!commentUrl) {
        return null;
      }
      const comment = {
        ...base,
        githubUsername: source.comment?.user?.login,
        commentUrl,
      };
      return source.type === 'github-pr-review-comment'
        ? {...comment, sourceType: source.type, reviewId: source.review_id}
        : {...comment, sourceType: source.type};
    }
    case 'github-pr-review-body':
      return {
        ...base,
        sourceType: 'github-pr-review-body',
        githubUsername: source.user?.login,
        reviewId: source.review_id,
        reviewState: source.review_state,
        reviewUrl: source.html_url,
      };
    case 'check-suite': {
      const {head_sha: headSha, id: checkSuiteId} = source.event.check_suite;
      const repoUrl = source.event.repository.html_url;
      return {
        ...base,
        text: t('CI failure detected'),
        sourceType: 'check-suite',
        checkSuiteUrl: `${repoUrl}/commit/${headSha}/checks?check_suite_id=${checkSuiteId}`,
      };
    }
    default:
      return {
        ...base,
        sourceType: 'other',
        source: parsed.source?.type ?? 'unknown',
      };
  }
}

function parseFeedback(raw: string): ParsedFeedback[] {
  const parsed: RawFeedback | RawFeedback[] = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(parseFeedbackItem).filter(defined);
}

/**
 * Collects the PR-iteration feedback to render in the Feedback section.
 *
 * PR iterations are folded into the section's blocks. Each drove one iteration;
 * the cumulative diff is already merged into the section's code-change artifact
 * by `getOrderedAutofixSections`, so here we only surface the feedback text.
 * Feedback on a block at/after the current step marker drives the iteration
 * still running (when the section is processing); everything earlier is pushed.
 * Feedback submitted mid-run that hasn't been folded into a block yet is
 * appended as `queued`. The list is returned newest-first.
 */
export function usePrIterationFeedback(
  section: AutofixSection,
  autofix: ReturnType<typeof useExplorerAutofix>,
  enabled: boolean
): {feedback: IterationFeedback[]; latestIterationIndex: number | null} {
  const currentStepStart = useMemo(
    () => section.blocks.findLastIndex(block => defined(block.message.metadata?.step)),
    [section.blocks]
  );

  const blockFeedback = useMemo<IterationFeedback[]>(() => {
    if (!enabled) {
      return [];
    }

    return section.blocks.flatMap((block, blockIndex) => {
      if (!isPrIterationBlock(block)) {
        return [];
      }

      const metadata = block.message.metadata;
      const value = metadata?.feedback;
      const iterationIndex = metadata?.iteration_index;

      if (!value || iterationIndex === undefined) {
        return [];
      }

      const status: FeedbackStatus =
        section.status === 'processing' && blockIndex >= currentStepStart
          ? 'in_progress'
          : 'processed';

      return parseFeedback(value).map(parsed => ({
        ...parsed,
        iterationIndex: Number(iterationIndex),
        status,
      }));
    });
  }, [section.blocks, section.status, currentStepStart, enabled]);

  const latestIterationIndex = useMemo(
    () =>
      blockFeedback.reduce<number | null>(
        (max, item) =>
          max === null ? item.iterationIndex : Math.max(max, item.iterationIndex),
        null
      ),
    [blockFeedback]
  );

  const queuedFeedback = useMemo<IterationFeedback[]>(() => {
    if (!enabled) {
      return [];
    }

    return (autofix.runState?.queued_feedback ?? []).flatMap(raw => {
      const parsed = parseFeedbackItem(raw);
      if (!parsed) {
        return [];
      }

      return [
        {
          ...parsed,
          iterationIndex: (latestIterationIndex ?? -1) + 1,
          status: 'queued' as const,
        },
      ];
    });
  }, [autofix.runState?.queued_feedback, latestIterationIndex, enabled]);

  const feedback = useMemo(
    () => [...blockFeedback, ...queuedFeedback].reverse(),
    [blockFeedback, queuedFeedback]
  );

  return {feedback, latestIterationIndex};
}

type FeedbackNode =
  | {item: IterationFeedback; type: 'item'}
  | {
      body: GithubPrReviewBodyFeedback & IterationFeedback;
      comments: IterationFeedback[];
      type: 'review';
    };

// A group forms only when a review body is present (a comment-only review — e.g.
// GitHub's "Add single comment" — stays flat). Keyed on `(iterationIndex,
// reviewId)`: `reviewId` is unique per PR and a review drives exactly one
// iteration, so the pair can't collide across replays. Grouped comments are
// identified up front by reference and the group anchored at the body's position,
// so the caller's newest-first order (a comment can precede its body) is handled.
function groupFeedback(items: IterationFeedback[]): FeedbackNode[] {
  const key = (iterationIndex: number, reviewId: number) =>
    `${iterationIndex}:${reviewId}`;

  const bodies = new Map<string, GithubPrReviewBodyFeedback & IterationFeedback>();
  for (const item of items) {
    if (item.sourceType === 'github-pr-review-body' && item.reviewId !== undefined) {
      bodies.set(key(item.iterationIndex, item.reviewId), item);
    }
  }

  const commentsByReview = new Map<string, IterationFeedback[]>();
  const groupedComments = new Set<IterationFeedback>();
  for (const item of items) {
    if (item.sourceType !== 'github-pr-review-comment' || item.reviewId === undefined) {
      continue;
    }
    const k = key(item.iterationIndex, item.reviewId);
    if (!bodies.has(k)) {
      continue;
    }
    const bucket = commentsByReview.get(k) ?? [];
    bucket.push(item);
    commentsByReview.set(k, bucket);
    groupedComments.add(item);
  }

  const nodes: FeedbackNode[] = [];
  for (const item of items) {
    if (item.sourceType === 'github-pr-review-body' && item.reviewId !== undefined) {
      const k = key(item.iterationIndex, item.reviewId);
      nodes.push({
        type: 'review',
        body: bodies.get(k)!,
        comments: commentsByReview.get(k) ?? [],
      });
      continue;
    }
    if (groupedComments.has(item)) {
      // Rendered under its group header; drop the flat row.
      continue;
    }
    nodes.push({type: 'item', item});
  }
  return nodes;
}

export function FeedbackList({items}: {items: IterationFeedback[]}) {
  if (items.length === 0) {
    return null;
  }

  const nodes = groupFeedback(items);

  return (
    <ArtifactDetails>
      <Text bold>{t('Feedback')}</Text>
      {nodes.map((node, index) =>
        node.type === 'review' ? (
          <ReviewGroup
            key={`review-${node.body.iterationIndex}-${node.body.reviewId}-${index}`}
            body={node.body}
            comments={node.comments}
          />
        ) : (
          <FeedbackItem key={`${node.item.iterationIndex}-${index}`} item={node.item} />
        )
      )}
    </ArtifactDetails>
  );
}

function ReviewGroup({
  body,
  comments,
}: {
  body: GithubPrReviewBodyFeedback & IterationFeedback;
  comments: IterationFeedback[];
}) {
  return (
    // `gap="0"`: all spacing lives inside the rows (their `padding-top`) so the
    // tree rule spans it continuously. A gap here would sit outside every row —
    // an uncovered blank stretch under the header, plus a double gap before the
    // first comment.
    <Stack gap="0">
      <FeedbackItem item={body} />
      {comments.length > 0 && (
        // `marginLeft` aligns the tree rule under the header avatar's center
        // (`AVATAR_SIZE / 2` === `space.lg`).
        <Stack gap="0" marginLeft="lg">
          {comments.map((comment, index) => (
            <ReviewChildRow key={`${comment.iterationIndex}-${index}`}>
              <FeedbackItem item={comment} />
            </ReviewChildRow>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

const TREE_BRANCH_WIDTH = 16;
const TREE_ELBOW_RADIUS = 8;

// Rows abut (no gap) and space themselves with `padding-top` so their vertical
// segments join into one continuous rule. The branch is anchored at the vertical
// center of the comment's avatar so it holds when the comment text wraps.
const ReviewChildRow = styled('div')`
  position: relative;
  padding-top: ${p => p.theme.space.md};
  padding-left: ${TREE_BRANCH_WIDTH + 12}px;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: calc(${p => p.theme.space.md} + ${AVATAR_SIZE / 2}px);
    width: ${TREE_BRANCH_WIDTH}px;
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  /* One L-shaped box so the rule curves into the branch (rounded elbow) instead
     of running past the last comment. */
  &:last-child::before {
    height: calc(${p => p.theme.space.md} + ${AVATAR_SIZE / 2}px);
    width: ${TREE_BRANCH_WIDTH}px;
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    border-bottom-left-radius: ${TREE_ELBOW_RADIUS}px;
  }
  &:last-child::after {
    display: none;
  }
`;

// Each source type owns an `Avatar` and a `Comment` cell. `FeedbackItem` renders
// the shared grid shell (avatar · comment · timestamp · status) and dispatches
// the two varying cells through this table — the single place that switches on
// `sourceType`. Adding a source means adding one entry plus its cell components.
type FeedbackCell = React.ComponentType<{item: IterationFeedback}>;

const SOURCE: Record<
  IterationFeedback['sourceType'],
  {Avatar: FeedbackCell; Comment: FeedbackCell}
> = {
  'user-ui': {Avatar: UserUiAvatar, Comment: UserUiComment},
  'github-pr-comment': {Avatar: GithubAvatar, Comment: GithubComment},
  'github-pr-review-comment': {Avatar: GithubAvatar, Comment: GithubComment},
  'github-pr-review-body': {
    Avatar: GithubReviewBodyAvatar,
    Comment: GithubReviewBodyComment,
  },
  'check-suite': {Avatar: CheckSuiteAvatar, Comment: CheckSuiteComment},
  other: {Avatar: UnknownAvatarCell, Comment: OtherComment},
};

function FeedbackItem({item}: {item: IterationFeedback}) {
  const {Avatar, Comment} = SOURCE[item.sourceType];

  // Four columns: author avatar, comment, timestamp, status icon. `align="start"`
  // keeps the avatar top-aligned against multiline comments; each non-avatar cell
  // is at least one avatar tall (`minHeight`) so its content centers with the
  // avatar on a single line, and grows top-aligned once the comment wraps.
  return (
    <Grid columns="auto 1fr auto auto" gap="md" align="start">
      <Avatar item={item} />
      <Cell>
        <Comment item={item} />
      </Cell>
      <Cell>
        <FeedbackTimestamp item={item} />
      </Cell>
      {/* Status icon sits at the far right, after the timestamp. */}
      <Cell>
        <FeedbackStatusIcon status={item.status} />
      </Cell>
    </Grid>
  );
}

// A non-avatar grid cell: at least one avatar tall so its content centers with
// the avatar on a single line, and top-aligned once the content wraps taller.
function Cell({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" minWidth="0" minHeight={`${AVATAR_SIZE}px`}>
      {children}
    </Flex>
  );
}

function FeedbackTimestamp({item}: {item: IterationFeedback}) {
  return (
    <Text variant="muted" size="sm" wrap="nowrap">
      {item.status === 'queued' ? (
        t('Queued')
      ) : item.timestamp ? (
        <TimeSince date={item.timestamp} />
      ) : null}
    </Text>
  );
}

// Composes the single avatar tooltip: "<author> posted on <source>" when we
// know who authored it, otherwise just "Posted by <source>".
function postedOnLabel(author: string | null, source: string): string {
  return author ? t('%s posted on %s', author, source) : t('Posted by %s', source);
}

function UserUiAvatar({item}: {item: IterationFeedback}) {
  const user = item.sourceType === 'user-ui' ? (item.user ?? null) : null;
  const author = user ? userDisplayName(user) : null;
  return (
    <AuthorAvatar
      user={user}
      Icon={IconSeer}
      tooltip={postedOnLabel(author, t('Seer'))}
    />
  );
}

// Builds an `AvatarUser` from a bare GitHub login. We only get the login on the
// wire (no Sentry user, no avatar URL), so point the avatar at GitHub's per-login
// image (`github.com/<login>.png`). UserAvatar falls back to a letter avatar from
// the login if the image fails to load. Returns null when there's no login.
function githubAvatarUser(login: string | undefined): AvatarUser | null {
  if (!login) {
    return null;
  }
  return {
    // GitHub's noreply email for the login. `email` must be present so
    // UserAvatar's `isActor` check (`email === undefined`) treats this as an
    // AvatarUser and honors the `avatar` field — an Actor is forced to a letter
    // avatar. (The exact `ID+login@...` form needs the numeric GitHub user id,
    // which isn't on the wire, so we use the id-less variant.)
    email: `${login}@users.noreply.github.com`,
    username: login,
    name: login,
    avatar: {avatarType: 'upload', avatarUrl: `https://github.com/${login}.png`},
  } as AvatarUser;
}

function GithubAvatar({item}: {item: IterationFeedback}) {
  const login =
    item.sourceType === 'github-pr-comment' ||
    item.sourceType === 'github-pr-review-comment'
      ? item.githubUsername
      : undefined;
  return (
    <AuthorAvatar
      user={githubAvatarUser(login)}
      Icon={IconGithub}
      tooltip={postedOnLabel(login ?? null, t('GitHub'))}
    />
  );
}

function CheckSuiteAvatar() {
  // A system notice — no author, so the source icon is the primary glyph.
  return <PrimaryIconAvatar Icon={IconGithub} tooltip={t('GitHub Actions failed')} />;
}

// A comment whose author/source we can't identify. We render `LetterAvatar`
// directly (rather than `UserAvatar`) so we can hand it an explicit gray
// background: `UserAvatar` derives its color by hashing the identifier into a
// categorical palette that has no neutral, so a nameless user comes out a
// vivid color. `?` is the standard empty-name glyph (see `getInitials`).
function UnknownAvatarCell({item}: {item: IterationFeedback}) {
  const theme = useTheme();
  const configuration = {
    background: theme.tokens.background.secondary,
    content: theme.tokens.content.secondary,
    initials: '?',
  } as React.ComponentProps<typeof LetterAvatar>['configuration'];

  // Unknown source: show the raw source name alone (no "posted by" framing,
  // since we can't attribute it to an author or a known origin).
  const source = item.sourceType === 'other' ? item.source : t('unknown');

  return (
    <Tooltip title={source}>
      <AvatarFrame>
        <UnknownLetterAvatar round configuration={configuration} />
      </AvatarFrame>
    </Tooltip>
  );
}

// `LetterAvatar` is `position: absolute` with no intrinsic size; fill the frame.
const UnknownLetterAvatar = styled(LetterAvatar)`
  position: relative;
  width: ${AVATAR_SIZE}px;
  height: ${AVATAR_SIZE}px;
`;

function UserUiComment({item}: {item: IterationFeedback}) {
  return <CommentBody text={item.text} />;
}

function GithubComment({item}: {item: IterationFeedback}) {
  const url =
    item.sourceType === 'github-pr-comment' ||
    item.sourceType === 'github-pr-review-comment'
      ? item.commentUrl
      : undefined;
  // The comment text is plain; a trailing arrow links out to the PR comment.
  return <CommentBody text={item.text} externalUrl={url} />;
}

function GithubReviewBodyAvatar({item}: {item: IterationFeedback}) {
  const login =
    item.sourceType === 'github-pr-review-body' ? item.githubUsername : undefined;
  return (
    <AuthorAvatar
      user={githubAvatarUser(login)}
      Icon={IconGithub}
      tooltip={postedOnLabel(login ?? null, t('GitHub'))}
    />
  );
}

// Unmapped states (dismissed, pending, a future provider's) return null so the
// badge is simply omitted rather than crashing.
function reviewStateTag(
  state: string | undefined
): {label: string; variant: TagProps['variant']} | null {
  switch (state) {
    case 'approved':
      return {label: t('Approved'), variant: 'success'};
    case 'changes_requested':
      return {label: t('Changes requested'), variant: 'danger'};
    case 'commented':
      return {label: t('Reviewed'), variant: 'muted'};
    default:
      return null;
  }
}

function GithubReviewBodyComment({item}: {item: IterationFeedback}) {
  if (item.sourceType !== 'github-pr-review-body') {
    return null;
  }
  const tag = reviewStateTag(item.reviewState);
  return (
    <Flex align="center" gap="sm" wrap="wrap">
      {tag && <Tag variant={tag.variant}>{tag.label}</Tag>}
      {/* A bare state change has no body — show just the link. */}
      {item.text ? (
        <CommentBody text={item.text} externalUrl={item.reviewUrl} />
      ) : (
        item.reviewUrl && (
          <ExternalLink href={item.reviewUrl} aria-label={t('Open in GitHub')}>
            <InlineOpenIcon size="xs" />
          </ExternalLink>
        )
      )}
    </Flex>
  );
}

function CheckSuiteComment({item}: {item: IterationFeedback}) {
  const url = item.sourceType === 'check-suite' ? item.checkSuiteUrl : undefined;
  // Automated failures read as system notices: muted, with a link to the run.
  return <CommentBody text={item.text} externalUrl={url} muted />;
}

function OtherComment({item}: {item: IterationFeedback}) {
  // The source is surfaced in the avatar tooltip (see `UnknownAvatarCell`), so
  // the comment itself is just the plain text.
  return <CommentBody text={item.text} />;
}

function CommentBody({
  text,
  externalUrl,
  muted,
}: {
  text: string;
  externalUrl?: string;
  muted?: boolean;
}) {
  return (
    <Text variant={muted ? 'muted' : undefined}>
      {text}
      {externalUrl && (
        <ExternalLink href={externalUrl} aria-label={t('Open in GitHub')}>
          <InlineOpenIcon size="xs" />
        </ExternalLink>
      )}
    </Text>
  );
}

// One-avatar-square frame that positions a corner badge against its avatar.
function AvatarFrame({children}: {children: React.ReactNode}) {
  return (
    <Flex
      position="relative"
      align="center"
      justify="center"
      width={`${AVATAR_SIZE}px`}
      height={`${AVATAR_SIZE}px`}
      flex="0 0 auto"
    >
      {children}
    </Flex>
  );
}

// Author avatar when we know who authored the iteration; otherwise the source
// icon as the primary glyph (sized `lg` === AVATAR_SIZE to fill the frame). A
// single tooltip wraps the whole frame (avatar + badge) so hovering anywhere on
// it shows one unified "<author> posted on <source>" label.
function AuthorAvatar({
  user,
  Icon,
  tooltip,
}: {
  Icon: typeof IconSeer;
  tooltip: string;
  user: AvatarUser | null;
}) {
  if (!user) {
    return <PrimaryIconAvatar Icon={Icon} tooltip={tooltip} />;
  }
  return (
    <Tooltip title={tooltip}>
      <AvatarFrame>
        <UserAvatar size={AVATAR_SIZE} user={user} />
        {/* Bottom-right corner badge: a filled circle in the card background
            color behind the small source icon so it reads as separate from the
            avatar it overlaps. Centering leaves ~1px of slack around the 12px
            (`xs`) icon inside the 14px circle. */}
        <Flex
          position="absolute"
          right="-3px"
          bottom="-3px"
          align="center"
          justify="center"
          radius="full"
          background="primary"
          width={`${SOURCE_BADGE_SIZE}px`}
          height={`${SOURCE_BADGE_SIZE}px`}
        >
          <Icon size="xs" />
        </Flex>
      </AvatarFrame>
    </Tooltip>
  );
}

// The source icon as the primary glyph, for iterations with no author identity.
function PrimaryIconAvatar({Icon, tooltip}: {Icon: typeof IconSeer; tooltip: string}) {
  return (
    <Tooltip title={tooltip}>
      <AvatarFrame>
        <Icon size="lg" />
      </AvatarFrame>
    </Tooltip>
  );
}

// Source-agnostic: the same three status glyphs regardless of where the
// iteration came from.
function FeedbackStatusIcon({status}: {status: FeedbackStatus}) {
  switch (status) {
    case 'processed':
      return (
        <Tooltip title={t('Changes from this feedback have been pushed')} skipWrapper>
          <Flex align="center" justify="center">
            <IconCircleCheckmark variant="accent" data-test-id="feedback-processed" />
          </Flex>
        </Tooltip>
      );
    case 'in_progress':
      return (
        <Tooltip title={t('This feedback is being processed')} skipWrapper>
          <LoadingIndicator size={16} style={{margin: 0}} />
        </Tooltip>
      );
    case 'queued':
      return (
        <Tooltip title={t('Queued, not yet picked up')} skipWrapper>
          <Flex align="center" justify="center">
            <IconCircle variant="muted" />
          </Flex>
        </Tooltip>
      );
    default:
      return null;
  }
}

// The inline external-link arrow sits with the last line of the comment. A small
// left margin separates it from the text. Emotion edge case: inline flow
// (`vertical-align`) isn't expressible through layout primitives.
const InlineOpenIcon = styled(IconOpen)`
  margin-bottom: 3px; /* align icon to text */
  margin-left: ${p => p.theme.space.xs};
  vertical-align: middle;
`;
