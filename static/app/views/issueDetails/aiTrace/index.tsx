import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {DataSection} from 'sentry/components/events/styles';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

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

const MCP_SERVER_URL = 'http://localhost:8080';

export function AITraceSection({event}: AITraceSectionProps) {
  const [traceData, setTraceData] = useState<AITraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConversation, setShowConversation] = useState(false);

  const commitHash =
    event.tags?.find(tag => tag.key === 'git_commit')?.value ||
    (typeof event.release === 'string' ? event.release.split('+')[1] : undefined);

  useEffect(() => {
    if (!commitHash) {
      setLoading(false);
      return;
    }

    fetch(`${MCP_SERVER_URL}/v2/traces/by-commit/${commitHash}/conversation`)
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
      <DataSection>
        <SectionHeader>
          <span>🤖 {t('AI Trace')}</span>
        </SectionHeader>
        <ContentBox>
          <LoadingIndicator mini />
        </ContentBox>
      </DataSection>
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
    <DataSection>
      <SectionHeader onClick={() => setIsExpanded(!isExpanded)}>
        <ChevronIcon isExpanded={isExpanded} />
        <span>🤖 {t('AI Trace')}</span>
      </SectionHeader>

      {isExpanded && (
        <ContentBox>
          <InfoGrid>
            <InfoRow>
              <Label>{t('Session ID')}</Label>
              <Value>{metadata.session_id.substring(0, 16)}...</Value>
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
            {showConversation ? '▼' : '▶'} {t('View Conversation')} (
            {conversation.length})
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
      )}
    </DataSection>
  );
}

const SectionHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  cursor: pointer;
  padding: ${space(2)} 0;
  font-weight: 600;
`;

const ChevronIcon = styled(IconChevron)<{isExpanded: boolean}>`
  transform: ${p => (p.isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)')};
  transition: transform 0.15s;
`;

const ContentBox = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 4px;
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
`;

const Label = styled('div')`
  color: ${p => p.theme.colors.gray600};
  font-weight: 600;
`;

const Value = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
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
