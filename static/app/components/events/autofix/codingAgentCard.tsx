import React from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {ExternalLink} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';
import {
  CodingAgentProvider,
  CodingAgentStatus,
  type CodingAgentState,
  type SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCode, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';

const animationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0},
  initial: {opacity: 0},
  animate: {opacity: 1},
  transition: testableTransition({duration: 0.3}),
};

interface CodingAgentCardProps {
  codingAgentState: CodingAgentState;
  repo?: SeerRepoDefinition;
}

function CodingAgentCard({codingAgentState, repo}: CodingAgentCardProps) {
  const getTagVariant = (status: CodingAgentStatus): TagProps['variant'] => {
    switch (status) {
      case CodingAgentStatus.COMPLETED:
        return 'success';
      case CodingAgentStatus.FAILED:
        return 'danger';
      case CodingAgentStatus.PENDING:
      case CodingAgentStatus.RUNNING:
      default:
        return 'info';
    }
  };

  const getStatusText = (status: CodingAgentStatus) => {
    switch (status) {
      case CodingAgentStatus.PENDING:
        return t('Pending...');
      case CodingAgentStatus.RUNNING:
        return t('Running...');
      case CodingAgentStatus.COMPLETED:
        return t('Completed');
      case CodingAgentStatus.FAILED:
        return t('Failed');
      default:
        return status;
    }
  };

  const shouldShowSpinner = (status: CodingAgentStatus) => {
    return status === CodingAgentStatus.PENDING || status === CodingAgentStatus.RUNNING;
  };

  const getProviderName = (provider: CodingAgentProvider) => {
    switch (provider) {
      case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
        return t('Cursor Cloud Agent');
      case CodingAgentProvider.GITHUB_COPILOT_AGENT:
        return t('GitHub Copilot');
      default:
        return t('Coding Agent');
    }
  };

  const hasButtons = Boolean(
    codingAgentState.agent_url || codingAgentState.results?.some(result => result.pr_url)
  );

  return (
    <React.Fragment>
      <VerticalLine />
      <StepCard>
        <ContentWrapper>
          <AnimatePresence>
            <motion.div key="coding-agent" {...animationProps}>
              <StyledCard>
                <HeaderWrapper>
                  <HeaderText>
                    {shouldShowSpinner(codingAgentState.status) ? (
                      <StyledLoadingIndicator size={16} />
                    ) : (
                      <IconCode size="md" color="purple400" />
                    )}
                    {getProviderName(codingAgentState.provider)}
                  </HeaderText>
                </HeaderWrapper>

                <Content>
                  <CardHeader>
                    <AgentTitle>{codingAgentState.name}</AgentTitle>
                    <div>
                      <Tag variant={getTagVariant(codingAgentState.status)}>
                        {getStatusText(codingAgentState.status)}
                      </Tag>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {repo && (
                      <DetailRow>
                        <Label>{t('Repository')}:</Label>
                        <Value>
                          {repo.owner}/{repo.name}
                        </Value>
                      </DetailRow>
                    )}

                    <DetailRow>
                      {t('Started')}
                      <DateTime date={codingAgentState.started_at} />
                    </DetailRow>
                  </CardContent>
                </Content>
                {hasButtons && (
                  <React.Fragment>
                    <BottomDivider />
                    <BottomButtonContainer>
                      <ButtonBar>
                        {codingAgentState.agent_url && (
                          <ExternalLink href={codingAgentState.agent_url}>
                            <Button
                              size="sm"
                              icon={<IconOpen />}
                              analyticsEventName="Autofix: Open Coding Agent"
                              analyticsEventKey="autofix.coding_agent.open"
                            >
                              {codingAgentState.provider ===
                              CodingAgentProvider.CURSOR_BACKGROUND_AGENT
                                ? t('Open in Cursor')
                                : t('View Agent')}
                            </Button>
                          </ExternalLink>
                        )}
                        {codingAgentState.results
                          ?.filter(result => result.pr_url)
                          .map(({pr_url}) => (
                            <ExternalLink key={pr_url} href={pr_url ?? ''}>
                              <Button
                                size="sm"
                                icon={<IconOpen />}
                                analyticsEventName="Autofix: Open Coding Agent PR"
                                analyticsEventKey="autofix.coding_agent.open_pr"
                                priority="primary"
                              >
                                {t('View Pull Request')}
                              </Button>
                            </ExternalLink>
                          ))}
                      </ButtonBar>
                    </BottomButtonContainer>
                  </React.Fragment>
                )}
              </StyledCard>
            </motion.div>
          </AnimatePresence>
        </ContentWrapper>
      </StepCard>
    </React.Fragment>
  );
}

export default CodingAgentCard;

const VerticalLine = styled('div')`
  width: 0;
  height: ${p => p.theme.space.xl};
  border-left: 1px solid ${p => p.theme.border};
  margin-left: 16px;
  margin-bottom: -1px;
`;

const StepCard = styled('div')`
  overflow: hidden;

  :last-child {
    margin-bottom: 0;
  }
`;

const ContentWrapper = styled(motion.div)`
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 300ms;
  will-change: grid-template-rows;

  > div {
    /* So that focused element outlines don't get cut off */
    padding: 0 1px;
    overflow: hidden;
  }
`;

const StyledCard = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-left: ${p => p.theme.space.xl};
  padding-right: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.primary};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.xl} 0 ${p => p.theme.space.md} 0;
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const Content = styled('div')`
  padding: ${p => p.theme.space.md} 0 ${p => p.theme.space.xl} 0;
`;

const CardHeader = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  margin-bottom: ${p => p.theme.space.md};
`;

const AgentTitle = styled('h4')`
  margin: 0 0 ${p => p.theme.space.xs} 0;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.primary};
`;

const CardContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const DetailRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const Label = styled('span')`
  font-weight: 600;
  color: ${p => p.theme.subText};
  min-width: 80px;
`;

const Value = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  margin: 0;
  margin-bottom: ${p => p.theme.space['2xs']};
`;

const BottomDivider = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const BottomButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding-top: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space.xl};
`;
