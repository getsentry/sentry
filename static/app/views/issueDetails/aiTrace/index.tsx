import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface AITraceData {
  conversation: Array<{
    content: string;
    role: string;
    tool_uses?: Array<{name: string}>;
  }>;
  metadata: {
    model_id: string;
    project_path: string;
    session_id: string;
    summary: string;
    timestamp: string;
    tool_name: string;
  };
}

interface AITraceSectionProps {
  event: Event;
  group: Group;
  project: Project;
}

// ngrok URL for Vercel deployment (real data) - paid plan removes browser warning
const MCP_SERVER_URL = 'https://unpargeted-superextreme-kenna.ngrok-free.dev';
const MCP_API_KEY = 'mwu18CWSSa7jSGHi53ZkcyoG9Z9s3S6B2uCX7FPPRy4';

// Demo mode: set to false to use real data from MCP server
const USE_DEMO_DATA = false;

const DEMO_DATA: AITraceData = {
  metadata: {
    model_id: 'claude-sonnet-4-5-20250929',
    project_path: '/Users/antonis/git/vibetrace',
    session_id: '04b613db-e3e7-43dd-b2d7-70fa5fbb1717',
    summary: 'Implement Vibe Trace integration with Sentry',
    timestamp: '2026-02-18T14:30:00Z',
    tool_name: 'claude-code',
  },
  conversation: [
    {
      role: 'user',
      content:
        'I want to test the full end-to-end flow of Vibe Trace - linking AI conversations to Sentry errors',
    },
    {
      role: 'assistant',
      content:
        "I'll help you test the complete Vibe Trace flow. Let me create a test scenario that demonstrates how AI-generated code errors are linked back to their conversation context in Sentry...",
      tool_uses: [{name: 'Write'}, {name: 'Bash'}],
    },
    {
      role: 'user',
      content:
        "Let's modify the Sentry codebase directly instead of using Tampermonkey. I'll deploy via Vercel for testing.",
    },
    {
      role: 'assistant',
      content:
        "Great idea! I'll create a native React component in the Sentry codebase. This will be more maintainable and won't require browser extensions...",
      tool_uses: [{name: 'Write'}, {name: 'Edit'}, {name: 'Read'}],
    },
    {
      role: 'user',
      content: 'Can you fix the TypeScript errors showing up in the build?',
    },
    {
      role: 'assistant',
      content:
        "I'll fix the TypeScript errors related to Sentry's theme system. The theme uses tokens.* properties rather than direct color properties...",
      tool_uses: [{name: 'Edit'}],
    },
  ],
};

export function AITraceSection({event, group}: AITraceSectionProps) {
  const [traceData, setTraceData] = useState<AITraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConversation, setShowConversation] = useState(false);

  // Extract commit hash with priority order:
  // 1. Sentry's suspect commits (automatic detection via repository integration)
  // 2. Manual git_commit tag (backward compatibility)
  // 3. Release field format (backward compatibility)
  let commitHash: string | undefined;

  // Priority 1: Use Sentry's suspect commits (most reliable)
  if (group.suspectCommits && group.suspectCommits.length > 0) {
    commitHash = group.suspectCommits[0].id;
  }

  // Priority 2: Fall back to manual git_commit tag
  if (!commitHash) {
    const gitCommitTag = event.tags?.find(tag => tag.key === 'git_commit');
    if (gitCommitTag?.value) {
      commitHash = gitCommitTag.value;
    }
  }

  // Priority 3: Fall back to release field
  if (!commitHash && typeof event.release === 'string') {
    const releaseString = event.release as string;
    const parts = releaseString.split('+');
    if (parts.length > 1) {
      commitHash = parts[1];
    }
  }

  useEffect(() => {
    if (!commitHash) {
      setLoading(false);
      return;
    }

    if (USE_DEMO_DATA) {
      // Use hardcoded demo data for UI testing
      setTimeout(() => {
        setTraceData(DEMO_DATA);
        setLoading(false);
      }, 500); // Simulate network delay
      return;
    }

    fetch(`${MCP_SERVER_URL}/v2/traces/by-commit/${commitHash}/conversation`, {
      headers: {
        'X-API-Key': MCP_API_KEY,
      },
    })
      .then(response => response.json())
      .then(data => {
        if (data.found) {
          setTraceData(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [commitHash]);

  if (!commitHash || (!loading && !traceData)) {
    return null;
  }

  if (loading) {
    return (
      <InterimSection type="agent-trace" title={t('Agent Trace')}>
        <LoadingIndicator mini />
      </InterimSection>
    );
  }

  if (!traceData) {
    return null;
  }

  const {metadata, conversation} = traceData;
  const deepLink =
    metadata.tool_name === 'cursor'
      ? `cursor://open-conversation?id=${metadata.session_id}&project=${encodeURIComponent(metadata.project_path)}`
      : `claude-code://open-session?id=${metadata.session_id}&project=${encodeURIComponent(metadata.project_path)}`;
  const toolName = metadata.tool_name === 'cursor' ? 'Cursor' : 'Claude Code';

  return (
    <InterimSection type="agent-trace" title={t('Agent Trace')}>
      <ContentBox>
        <InfoGrid>
          <InfoRow>
            <Label>{t('Session ID')}</Label>
            <SessionIdValue>
              <SessionIdText>{metadata.session_id}</SessionIdText>
              <StyledCopyButton
                text={metadata.session_id}
                size="xs"
                aria-label={t('Copy Session ID')}
              />
            </SessionIdValue>
          </InfoRow>
          <InfoRow>
            <Label>{t('Model')}</Label>
            <Value>{metadata.model_id}</Value>
          </InfoRow>
          <InfoRow>
            <Label>{t('Summary')}</Label>
            <Value>{metadata.summary}</Value>
          </InfoRow>
        </InfoGrid>

        <Button
          size="sm"
          icon={<IconOpen />}
          onClick={() => {
            window.location.href = deepLink;
          }}
        >
          {t('Open in')} {toolName}
        </Button>

        <ToggleButton onClick={() => setShowConversation(!showConversation)}>
          {showConversation ? '▼' : '▶'} {t('View Conversation')} ({conversation.length})
        </ToggleButton>

        {showConversation && (
          <ConversationBox>
            {conversation.slice(0, 10).map((turn, i) => (
              <Turn key={i}>
                <TurnLabel>{turn.role === 'user' ? '👤 User' : '🤖 Assistant'}</TurnLabel>
                <TurnText>{turn.content.substring(0, 300)}...</TurnText>
              </Turn>
            ))}
          </ConversationBox>
        )}
      </ContentBox>
    </InterimSection>
  );
}

const ContentBox = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const InfoGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;

const InfoRow = styled('div')`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: ${space(2)};
  align-items: start;
`;

const Label = styled('div')`
  color: ${p => p.theme.colors.gray600};
  font-weight: 600;
`;

const Value = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const SessionIdValue = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const SessionIdText = styled('code')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  word-break: break-all;
`;

const StyledCopyButton = styled(CopyToClipboardButton)`
  min-width: auto;
  height: 20px;
  flex-shrink: 0;
`;

const ToggleButton = styled('div')`
  margin-top: ${space(2)};
  padding: ${space(1)} ${space(2)};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
`;

const ConversationBox = styled('div')`
  margin-top: ${space(2)};
  max-height: 400px;
  overflow-y: auto;
`;

const Turn = styled('div')`
  padding: ${space(1.5)};
  margin-bottom: ${space(1)};
  border-left: 3px solid ${p => p.theme.colors.blue300};
  background: ${p => p.theme.tokens.background.secondary};
`;

const TurnLabel = styled('div')`
  font-weight: 600;
  margin-bottom: ${space(0.5)};
`;

const TurnText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
