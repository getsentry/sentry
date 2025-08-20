import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text/heading';
import ExternalLink from 'sentry/components/links/externalLink';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconClose, IconSeer} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {sanitizedMarked} from 'sentry/utils/marked/marked';

import FixWithSeerModal from './fixWithSeerModal';
import type {GitHubComment} from './types';

// Remove GitHub feedback prompts and convert emoji shortcuts
function processCommentText(text: string): {
  cleanText: string;
  hasFeedbackPrompt: boolean;
} {
  // Check if the comment contains feedback prompt
  const hasFeedbackPrompt =
    /Did we get this right\?\s*[:\+\-\d\/\s]*to inform future reviews/i.test(text);

  // Remove feedback prompt text
  const cleanText = text
    .replace(/Did we get this right\?\s*[:\+\-\d\/\s]*to inform future reviews\.?/gi, '')
    .replace(/^\s*\n+|\n+\s*$/g, '') // Remove leading/trailing newlines
    .replace(/:thumbsup:|:\+1:/g, '👍')
    .replace(/:thumbsdown:|:-1:/g, '👎')
    .replace(/:smile:/g, '😄')
    .replace(/:laughing:/g, '😆')
    .replace(/:confused:/g, '😕')
    .replace(/:heart:/g, '❤️')
    .replace(/:rocket:/g, '🚀')
    .replace(/:eyes:/g, '👀')
    .replace(/:fire:/g, '🔥')
    .replace(/:tada:/g, '🎉');

  return {cleanText, hasFeedbackPrompt};
}

interface CommentsListProps {
  comments: GitHubComment[];
  title: string;
  filename?: string;
  showLineNumbers?: boolean; // For file-specific comments to enable "Fix with Seer"
}

function FeedbackButtons({commentId: _commentId}: {commentId: number}) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);

  const handleFeedback = (type: 'helpful' | 'not-helpful') => {
    setFeedback(type);
    // Here you could send the feedback to your analytics/backend
    // analytics.record('pr-comment-feedback', { commentId, feedback: type });
  };

  if (feedback) {
    return (
      <FeedbackSection>
        <FeedbackMessage>
          Thanks for your feedback! {feedback === 'helpful' ? '👍' : '👎'}
        </FeedbackMessage>
      </FeedbackSection>
    );
  }

  return (
    <FeedbackSection>
      <FeedbackLabel>Was this helpful?</FeedbackLabel>
      <FeedbackButtonGroup>
        <Button
          size="xs"
          icon={<IconCheckmark />}
          onClick={() => handleFeedback('helpful')}
          aria-label="Mark as helpful"
        >
          Yes
        </Button>
        <Button
          size="xs"
          icon={<IconClose />}
          onClick={() => handleFeedback('not-helpful')}
          aria-label="Mark as not helpful"
        >
          No
        </Button>
      </FeedbackButtonGroup>
    </FeedbackSection>
  );
}

function CommentsList({
  comments,
  title,
  showLineNumbers = false,
  filename,
}: CommentsListProps) {
  const sortedComments = useMemo(
    () =>
      comments.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [comments]
  );

  const handleFixWithSeer = (commentFilename: string, comment: GitHubComment) => {
    openModal(modalProps => (
      <FixWithSeerModal
        {...modalProps}
        filename={commentFilename}
        comment={comment}
        onRun={(_instructions: string) => {
          // Here you would call your Seer analysis API
          // TODO: Implement actual Seer API call
          // const analysis = await api.requestPromise('/seer/analyze', {
          //   method: 'POST',
          //   data: {
          //     filename: commentFilename,
          //     instructions: _instructions,
          //     comment,
          //     comments: comments.filter(c => c.path === commentFilename)
          //   }
          // });
        }}
      />
    ));
  };

  if (!comments.length) {
    return null;
  }

  return (
    <Flex direction="column" gap="md">
      <Heading as="h2" size="md">
        {title}
      </Heading>
      {sortedComments.map(comment => {
        const {cleanText, hasFeedbackPrompt} = processCommentText(comment.body);

        return (
          <CommentItem key={comment.id}>
            <CommentHeader>
              <UserInfo>
                <UserAvatar
                  user={{
                    id: comment.user.id.toString(),
                    name: comment.user.login,
                    username: comment.user.login,
                    email: comment.user.login + '@github.com',
                    avatar: {avatarUrl: comment.user.avatar_url, avatarType: 'upload'},
                  }}
                  size={24}
                  gravatar={false}
                />
                <ExternalLink href={comment.user.html_url}>
                  <Username>{comment.user.login}</Username>
                </ExternalLink>
                <CommentMeta>
                  commented{' '}
                  <ExternalLink href={comment.html_url}>
                    <TimeSince date={comment.created_at} />
                  </ExternalLink>
                </CommentMeta>
              </UserInfo>
              {showLineNumbers && comment.line && (
                <LineInfo>
                  Line {comment.line}
                  {comment.side && ` (${comment.side.toLowerCase()})`}
                </LineInfo>
              )}
            </CommentHeader>

            <CommentBody>
              <CommentText
                dangerouslySetInnerHTML={{
                  __html: sanitizedMarked(cleanText),
                }}
              />

              {(hasFeedbackPrompt || filename) && (
                <CommentActions>
                  {filename && (
                    <Button
                      size="xs"
                      icon={<IconSeer />}
                      onClick={() => handleFixWithSeer(filename, comment)}
                    >
                      Fix with Seer
                    </Button>
                  )}
                  {hasFeedbackPrompt && <FeedbackButtons commentId={comment.id} />}
                </CommentActions>
              )}
            </CommentBody>
          </CommentItem>
        );
      })}
    </Flex>
  );
}

const CommentItem = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  margin-bottom: ${space(1)};
  background: ${p => p.theme.background};
  width: 100%;
  min-width: 0; /* Allow shrinking */
`;

const CommentHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.backgroundElevated};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: 6px 6px 0 0;
`;

const UserInfo = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const Username = styled('span')`
  font-weight: 600;
  color: ${p => p.theme.blue300};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const CommentMeta = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSize.sm};
`;

const LineInfo = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
  font-family: ${p => p.theme.text.familyMono};
`;

const CommentBody = styled('div')`
  padding: ${space(1.5)};
`;

const CommentText = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  color: ${p => p.theme.textColor}; /* Darker text color like GitHub */
  max-width: 100%;

  /* Style markdown elements */
  p {
    margin: ${space(0.5)} 0;
    &:first-child {
      margin-top: 0;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }

  code {
    background: ${p => p.theme.gray100};
    padding: ${space(0.25)} ${space(0.5)};
    border-radius: 3px;
    font-size: ${p => p.theme.fontSize.xs};
    word-break: break-all;
  }

  pre {
    background: ${p => p.theme.gray100};
    padding: ${space(1)};
    border-radius: 4px;
    overflow-x: auto;
    margin: ${space(1)} 0;

    code {
      background: none;
      padding: 0;
      word-break: normal;
    }
  }

  blockquote {
    border-left: 4px solid ${p => p.theme.gray200};
    padding-left: ${space(1)};
    margin: ${space(1)} 0;
    color: ${p => p.theme.gray300};
  }

  ul,
  ol {
    padding-left: ${space(2)};
    margin: ${space(0.5)} 0;
  }

  a {
    color: ${p => p.theme.blue300};
    text-decoration: none;
    word-break: break-all;

    &:hover {
      text-decoration: underline;
    }
  }

  /* GitHub-style table styling */
  table {
    border-collapse: separate; /* Use separate borders for outer border */
    border-spacing: 0;
    width: auto; /* Don't force full width */
    max-width: 100%;
    margin: ${space(2)} 0;
    border: 1px solid ${p => p.theme.border};
    border-radius: 6px;
    overflow: hidden;
    font-size: ${p => p.theme.fontSize.sm}; /* Smaller font for compactness */
  }

  th,
  td {
    padding: ${space(0.75)} ${space(1)};
    text-align: left;
    border-right: 1px solid ${p => p.theme.border};
    border-bottom: 1px solid ${p => p.theme.border};
    vertical-align: top;
    line-height: 1.4;
    white-space: nowrap; /* Prevent unnecessary wrapping */
  }

  /* Remove right border from last column */
  th:last-child,
  td:last-child {
    border-right: none;
  }

  /* Allow certain columns to wrap if needed */
  th:first-child,
  td:first-child {
    white-space: normal;
    min-width: 120px;
    max-width: 200px;
  }

  /* Status column - keep compact */
  th:nth-child(2),
  td:nth-child(2) {
    width: 100px;
    text-align: center;
  }

  /* Preview column - can be narrow */
  th:nth-child(3),
  td:nth-child(3) {
    width: 80px;
    text-align: center;
  }

  /* Comments column - can be narrow */
  th:nth-child(4),
  td:nth-child(4) {
    width: 80px;
    text-align: center;
  }

  /* Updated column - can be wider for dates */
  th:nth-child(5),
  td:nth-child(5) {
    width: 140px;
    white-space: nowrap;
  }

  th {
    background: ${p => p.theme.backgroundElevated};
    font-weight: 600;
    color: ${p => p.theme.textColor};
    border-bottom: 1px solid ${p => p.theme.border};
  }

  td {
    background: ${p => p.theme.background};
    color: ${p => p.theme.textColor};
  }

  /* Remove bottom border from last row */
  tr:last-child td {
    border-bottom: none;
  }

  /* Alternate row styling for better readability */
  tbody tr:nth-child(even) td {
    background: ${p => p.theme.backgroundElevated};
  }

  /* Status indicators in tables */
  td [style*='color: red'] {
    color: ${p => p.theme.red300} !important;
    font-weight: 500;
  }

  td [style*='color: green'] {
    color: ${p => p.theme.green300} !important;
    font-weight: 500;
  }
`;

const FeedbackSection = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-left: auto;
`;

const FeedbackLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
`;

const FeedbackButtonGroup = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const FeedbackMessage = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.green300};
  font-weight: 500;
`;

const CommentActions = styled('div')`
  margin-top: ${space(2)};
  padding-top: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  align-items: center;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

export default CommentsList;
