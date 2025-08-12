import React from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type AnimationProps} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {ExternalLink} from 'sentry/components/core/link';
import {
  type CodingAgentState,
  type SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import Spinner from 'sentry/components/forms/spinner';
import {IconCode, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import testableTransition from 'sentry/utils/testableTransition';

const animationProps: AnimationProps = {
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
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'running':
        return 'yellow300';
      case 'completed':
        return 'green300';
      case 'failed':
        return 'red300';
      default:
        return 'gray300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return t('Pending...');
      case 'running':
        return t('Running');
      case 'completed':
        return t('Completed');
      case 'failed':
        return t('Failed');
      default:
        return status;
    }
  };

  const shouldShowSpinner = (status: string) => {
    const lowerStatus = status.toLowerCase();
    return lowerStatus === 'pending' || lowerStatus === 'running';
  };

  return (
    <React.Fragment>
      <VerticalLine />
      <StepCard>
        <ContentWrapper>
          <AnimatePresence>
            <AnimationWrapper key="coding-agent" {...animationProps}>
              <StyledCard>
                <HeaderWrapper>
                  <HeaderText>
                    <IconCode size="sm" color="purple400" />
                    {t('Coding Agent')}
                  </HeaderText>
                  <ButtonBar>
                    {codingAgentState.agent_url && (
                      <ExternalLink href={codingAgentState.agent_url}>
                        <Button
                          size="sm"
                          icon={<IconOpen />}
                          analyticsEventName="Autofix: Open Cursor Agent"
                          analyticsEventKey="autofix.cursor_agent.open"
                        >
                          {t('Open in Cursor')}
                        </Button>
                      </ExternalLink>
                    )}
                    {codingAgentState.pr_url && (
                      <ExternalLink href={codingAgentState.pr_url}>
                        <Button
                          size="sm"
                          icon={<IconOpen />}
                          analyticsEventName="Autofix: Open Cursor Agent"
                          analyticsEventKey="autofix.cursor_agent.open"
                          priority="primary"
                        >
                          {t('View Pull Request')}
                        </Button>
                      </ExternalLink>
                    )}
                  </ButtonBar>
                </HeaderWrapper>

                <Content>
                  <CardHeader>
                    <AgentTitle>{codingAgentState.name}</AgentTitle>
                    <div>
                      <StatusBadge
                        status={codingAgentState.status}
                        color={getStatusColor(codingAgentState.status)}
                      >
                        {shouldShowSpinner(codingAgentState.status) && (
                          <SpinnerWrapper>
                            <Spinner />
                          </SpinnerWrapper>
                        )}
                        {getStatusText(codingAgentState.status)}
                      </StatusBadge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Show result description for completed or failed agents */}
                    {codingAgentState.result?.description && (
                      <ResultSection>
                        {codingAgentState.status.toLowerCase() === 'failed' && (
                          <Label>{t('Error')}</Label>
                        )}
                        <ResultDescription
                          status={codingAgentState.status}
                          dangerouslySetInnerHTML={{
                            __html: singleLineRenderer(
                              codingAgentState.result.description
                            ),
                          }}
                        />
                      </ResultSection>
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
                      <Label>{t('Started')}:</Label>
                      <Value>
                        {new Date(codingAgentState.started_at).toLocaleString()}
                      </Value>
                    </DetailRow>
                  </CardContent>
                </Content>
              </StyledCard>
            </AnimationWrapper>
          </AnimatePresence>
        </ContentWrapper>
      </StepCard>
    </React.Fragment>
  );
}

const VerticalLine = styled('div')`
  width: 0;
  height: ${space(4)};
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

const AnimationWrapper = styled(motion.div)``;

const StyledCard = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(1)};
  padding: ${space(2)} 0 ${space(1)} 0;
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const Content = styled('div')`
  padding: ${space(1)} 0 ${space(2)} 0;
`;

const CardHeader = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  margin-bottom: ${space(1)};
`;

const AgentTitle = styled('h4')`
  margin: 0 0 ${space(0.5)} 0;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;

const StatusBadge = styled('span')<{color: string; status: string}>`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  text-transform: uppercase;
  background-color: ${p => (p.theme as any)[p.color] || p.theme.gray300};
  color: ${p => p.theme.white};
`;

const SpinnerWrapper = styled('div')`
  display: flex;
  align-items: center;
  width: 12px;
  height: 12px;

  > div {
    width: 12px !important;
    height: 12px !important;
    border-width: 1.5px !important;
    border-left-color: ${p => p.theme.white};
    margin: 0 !important;
  }
`;

const CardContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const DetailRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
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

const ResultSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ResultDescription = styled('div')<{status: string}>`
  color: ${p =>
    p.status.toLowerCase() === 'failed' ? p.theme.red300 : p.theme.textColor};
  line-height: 1.4;
`;

export default CodingAgentCard;
