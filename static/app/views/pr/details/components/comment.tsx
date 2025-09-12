import {useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import ExternalLink from 'sentry/components/links/externalLink';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {sanitizedMarked} from 'sentry/utils/marked/marked';

import type {GitHubComment} from './types';

interface CommentProps {
  comment: GitHubComment;
  children?: React.ReactNode;
  initiallyCollapsed?: boolean;
  showLineNumbers?: boolean;
}

function Comment({
  comment,
  showLineNumbers = false,
  children,
  initiallyCollapsed = false,
}: CommentProps) {
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed);
  const isSeerBot = comment.user.login === 'seer-by-sentry[bot]';

  return (
    <CommentItem>
      <CommentHeader
        isSeerBot={isSeerBot}
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }
        }}
        aria-label={isCollapsed ? 'Expand comment' : 'Collapse comment'}
      >
        <UserInfo>
          <CollapseIcon direction={isCollapsed ? 'right' : 'down'} />
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
          <CommentHeaderText>
            <ExternalLink href={comment.user.html_url} onClick={e => e.stopPropagation()}>
              <Username>{comment.user.login}</Username>
            </ExternalLink>
            {' commented '}
            <ExternalLink href={comment.html_url} onClick={e => e.stopPropagation()}>
              <TimeSince date={comment.created_at} />
            </ExternalLink>
            {isCollapsed && (
              <CollapsedPreview>
                {comment.body.length > 50
                  ? comment.body.substring(0, 50) + '...'
                  : comment.body}
              </CollapsedPreview>
            )}
          </CommentHeaderText>
        </UserInfo>
        <HeaderActions>
          {showLineNumbers && comment.line && (
            <LineInfo>
              Line {comment.line}
              {comment.side && ` (${comment.side.toLowerCase()})`}
            </LineInfo>
          )}
        </HeaderActions>
      </CommentHeader>

      {!isCollapsed && (
        <CommentBody>
          <CommentText
            dangerouslySetInnerHTML={{
              __html: sanitizedMarked(comment.body),
            }}
          />
          {children}
        </CommentBody>
      )}
    </CommentItem>
  );
}

const CommentItem = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  margin: ${space(1)} 0;
  background: ${p => p.theme.background};
  width: 100%;
  min-width: 0; /* Allow shrinking */
`;

const CommentHeader = styled('div')<{isSeerBot?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => (p.isSeerBot ? p.theme.purple200 : p.theme.gray200)};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: 6px 6px 0 0;
  cursor: pointer;

  &:hover {
    background: ${p =>
      p.isSeerBot ? 'rgba(199, 178, 255, 0.5)' : 'rgba(0, 0, 0, 0.08)'};
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.focus};
    outline-offset: -2px;
  }
`;

const CollapseIcon = styled(IconChevron)`
  color: ${p => p.theme.gray400};
  margin-right: ${space(0.5)};
  width: 12px;
  height: 12px;
  flex-shrink: 0;
`;

const CollapsedPreview = styled('span')`
  margin-left: ${space(1)};
  color: ${p => p.theme.gray300};
  font-style: italic;
  font-size: ${p => p.theme.fontSize.xs};
`;

const HeaderActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const UserInfo = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const CommentHeaderText = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.gray300};

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const Username = styled('span')`
  font-weight: 600;
  color: ${p => p.theme.blue300} !important;

  &:hover {
    text-decoration: underline;
  }
`;

const LineInfo = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.gray300};
  font-family: ${p => p.theme.text.familyMono};
  margin-right: ${space(1)};
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
    border-collapse: separate;
    border-spacing: 0;
    width: auto;
    max-width: 100%;
    margin: ${space(2)} 0;
    border: 1px solid ${p => p.theme.border};
    border-radius: 6px;
    overflow: hidden;
    font-size: ${p => p.theme.fontSize.sm};
  }

  th,
  td {
    padding: ${space(0.75)} ${space(1)};
    text-align: left;
    border-right: 1px solid ${p => p.theme.border};
    border-bottom: 1px solid ${p => p.theme.border};
    vertical-align: top;
    line-height: 1.4;
    white-space: nowrap;
  }

  th:last-child,
  td:last-child {
    border-right: none;
  }

  th:first-child,
  td:first-child {
    white-space: normal;
    min-width: 120px;
    max-width: 200px;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 100px;
    text-align: center;
  }

  th:nth-child(3),
  td:nth-child(3) {
    width: 80px;
    text-align: center;
  }

  th:nth-child(4),
  td:nth-child(4) {
    width: 80px;
    text-align: center;
  }

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

  tr:last-child td {
    border-bottom: none;
  }

  tbody tr:nth-child(even) td {
    background: ${p => p.theme.backgroundElevated};
  }

  td [style*='color: red'] {
    color: ${p => p.theme.red300} !important;
    font-weight: 500;
  }

  td [style*='color: green'] {
    color: ${p => p.theme.green300} !important;
    font-weight: 500;
  }
`;

export default Comment;
