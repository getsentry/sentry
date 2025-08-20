import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text/heading';
import {IconCheckmark, IconClose, IconSeer} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import Comment from './comment';
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
          <Comment
            key={comment.id}
            comment={{...comment, body: cleanText}}
            showLineNumbers={showLineNumbers}
          >
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
          </Comment>
        );
      })}
    </Flex>
  );
}

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
