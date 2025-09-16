import React from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
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
import {singleLineRenderer} from 'sentry/utils/marked/marked';
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
  const getTagType = (status: CodingAgentStatus): TagProps['type'] => {
    switch (status) {
      case CodingAgentStatus.COMPLETED:
        return 'success';
      case CodingAgentStatus.FAILED:
        return 'error';
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
        return t('Cursor Background Agent');
      default:
        return t('Coding Agent');
    }
  };

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
                  <ButtonBar>
                    {codingAgentState.agent_url && (
                      <ExternalLink href={codingAgentState.agent_url}>
                        <Button
                          size="sm"
                          icon={<IconOpen />}
                          analyticsEventName="Autofix: Open Coding Agent"
                          analyticsEventKey="autofix.coding_agent.open"
                        >
                          {t('Open in Cursor')}
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
                </HeaderWrapper>

                <Content>
                  <CardHeader>
                    <AgentTitle>{codingAgentState.name}</AgentTitle>
                    <div>
                      <Tag type={getTagType(codingAgentState.status)}>
                        {getStatusText(codingAgentState.status)}
                      </Tag>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Show results for completed or failed agents */}
                    {codingAgentState.results && codingAgentState.results.length > 0 && (
                      <ResultsSection>
                        {codingAgentState.status === CodingAgentStatus.FAILED && (
                          <Label>{t('Error')}</Label>
                        )}
                        {codingAgentState.results.map((result, index) => (
                          <ResultItem key={index}>
                            <Text density="comfortable">
                              <ResultDescription
                                status={codingAgentState.status}
                                dangerouslySetInnerHTML={{
                                  __html: singleLineRenderer(result.description),
                                }}
                              />
                            </Text>
                            {result.branch_name && (
                              <DetailRow>
                                <Label>{t('Branch')}:</Label>
                                <Value>{result.branch_name}</Value>
                              </DetailRow>
                            )}
                          </ResultItem>
                        ))}
                      </ResultsSection>
                    )}

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
  height: ${p => p.theme.space['3xl']};
  border-left: 2px solid ${p => p.theme.subText};
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
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-left: ${p => p.theme.space.xl};
  padding-right: ${p => p.theme.space.xl};
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
  color: ${p => p.theme.textColor};
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
  color: ${p => p.theme.textColor};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

const ResultsSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

const ResultItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.md} 0;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const ResultDescription = styled('div')<{status: CodingAgentStatus}>`
  color: ${p =>
    p.status === CodingAgentStatus.FAILED ? p.theme.errorText : p.theme.textColor};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  margin: 0;
  margin-bottom: ${p => p.theme.space['2xs']};
`;
