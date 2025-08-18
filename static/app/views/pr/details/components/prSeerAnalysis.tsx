import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconLab, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface PRSeerAnalysisProps {
  issues: Group[];
  prId: string;
  repoName: string;
}

interface SeerAnalysis {
  analysis: string;
  insights: Array<{
    description: string;
    title: string;
    type: 'suggestion' | 'warning' | 'info';
  }>;
  status: 'pending' | 'completed' | 'error';
  custom_instructions?: string;
}

function PRSeerAnalysis({repoName: _repoName, prId: _prId, issues}: PRSeerAnalysisProps) {
  const _organization = useOrganization();
  const _api = useApi();

  const [analysis, setAnalysis] = useState<SeerAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructionsInput, setShowInstructionsInput] = useState(false);

  const runSeerAnalysis = useCallback(
    async (instructions?: string) => {
      if (issues.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        // Use the first issue for analysis (simplified mock)
        const firstIssue = issues[0];

        // For now, simulate Seer analysis since the endpoint may not exist yet
        // TODO: Replace with actual API call when backend is ready
        const aggregatedAnalysis: SeerAnalysis = {
          analysis: `Analysis for issue "${firstIssue.title}" (${firstIssue.shortId}):\n\nThis issue appears to be related to the changes in this PR. The error pattern suggests potential issues with the modified code paths.`,
          insights: [
            {
              title: `Issue ${firstIssue.shortId} Root Cause`,
              description: `The error may be caused by changes in the PR files. Consider reviewing the modified functions and their error handling.`,
              type: 'suggestion' as const,
            },
          ],
          custom_instructions: instructions || customInstructions,
          status: 'completed',
        };

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        setAnalysis(aggregatedAnalysis);
      } catch (err) {
        setError(t('Failed to analyze issues with Seer. Please try again.'));
      } finally {
        setLoading(false);
      }
    },
    [issues, customInstructions]
  );

  const handleRunAnalysis = useCallback(() => {
    runSeerAnalysis(customInstructions);
    setShowInstructionsInput(false);
  }, [runSeerAnalysis, customInstructions]);

  // Auto-run analysis when issues are first loaded
  useEffect(() => {
    if (issues.length > 0 && !analysis && !loading) {
      runSeerAnalysis();
    }
  }, [issues, analysis, loading, runSeerAnalysis]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'suggestion':
        return '💡';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <SeerPanel>
      <PanelHeader>
        <HeaderContent justify="between" align="center">
          <HeaderText align="center" gap="md">
            <IconSeer size="sm" />
            {t('Seer Analysis')}
          </HeaderText>
          <ButtonGroup align="center" gap="md">
            {!loading && (
              <Fragment>
                <Button
                  size="xs"
                  onClick={() => setShowInstructionsInput(!showInstructionsInput)}
                >
                  {t('Custom Instructions')}
                </Button>
              </Fragment>
            )}
          </ButtonGroup>
        </HeaderContent>
      </PanelHeader>

      <StyledPanelBody>
        {showInstructionsInput && (
          <InstructionsSection direction="column" gap="md">
            <Text as="label" bold size="sm">
              {t('Custom Instructions for Analysis:')}
            </Text>
            <InstructionsTextarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder={t('Add specific context or questions for Seer to focus on...')}
            />
            <Button size="sm" onClick={handleRunAnalysis}>
              {t('Run Analysis')}
            </Button>
          </InstructionsSection>
        )}

        {loading ? (
          <LoadingContainer direction="column" align="center" gap="md">
            <LoadingIndicator />
            <Text variant="muted" size="sm">
              {t('Analyzing issues with Seer...')}
            </Text>
          </LoadingContainer>
        ) : error ? (
          <ErrorMessage variant="danger">{error}</ErrorMessage>
        ) : analysis ? (
          <AnalysisContent direction="column" gap="md">
            {analysis.insights.length > 0 && (
              <InsightsSection direction="column" gap="md">
                {analysis.insights.map((insight, index) => (
                  <InsightItem key={index}>
                    <InsightHeader align="center" gap="md">
                      <span>{getInsightIcon(insight.type)}</span>
                      <Text bold>{insight.title}</Text>
                    </InsightHeader>
                    <Text variant="muted" style={{lineHeight: 1.4}}>
                      {insight.description}
                    </Text>
                  </InsightItem>
                ))}
              </InsightsSection>
            )}

            {analysis.analysis && (
              <AnalysisSection direction="column" gap="md">
                <AnalysisText variant="muted">{analysis.analysis}</AnalysisText>
              </AnalysisSection>
            )}

            {analysis.custom_instructions && (
              <CustomInstructionsUsed size="sm" variant="muted" italic>
                <Text as="span" bold>
                  {t('Custom instructions used:')}
                </Text>{' '}
                {analysis.custom_instructions}
              </CustomInstructionsUsed>
            )}
          </AnalysisContent>
        ) : issues.length === 0 ? (
          <PlaceholderMessage variant="muted" italic>
            {t(
              'No issues found to analyze. When issues are detected in this PR, Seer will provide AI-powered insights.'
            )}
          </PlaceholderMessage>
        ) : (
          <PlaceholderMessage>
            <Button
              priority="primary"
              size="sm"
              icon={<IconLab />}
              onClick={() => runSeerAnalysis()}
            >
              {t('Analyze with Seer')}
            </Button>
          </PlaceholderMessage>
        )}
      </StyledPanelBody>
    </SeerPanel>
  );
}

const SeerPanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
`;

const HeaderContent = styled(Flex)`
  width: 100%;
`;

const HeaderText = styled(Flex)`
  font-weight: 600;
`;

const ButtonGroup = styled(Flex)``;

const LoadingContainer = styled(Flex)`
  padding: ${space(3)};
`;

const ErrorMessage = styled(Text)`
  padding: ${space(2)};
  background: ${p => p.theme.red100};
  border: 1px solid ${p => p.theme.red200};
  border-radius: 4px;
`;

const PlaceholderMessage = styled(Text)`
  padding: ${space(2)};
  text-align: center;
`;

const AnalysisContent = styled(Flex)``;

const InsightsSection = styled(Flex)``;

const InsightItem = styled('div')`
  padding: ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 4px;
  border-left: 3px solid ${p => p.theme.blue300};
`;

const InsightHeader = styled(Flex)`
  margin-bottom: ${space(1)};
`;

const AnalysisSection = styled(Flex)``;

const AnalysisText = styled(Text)`
  line-height: 1.5;
  white-space: pre-wrap;
  padding: ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 4px;
`;

const InstructionsSection = styled(Flex)`
  margin-bottom: ${space(2)};
  padding: ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 4px;
  margin-top: 0;
`;

const InstructionsTextarea = styled('textarea')`
  min-height: 80px;
  padding: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 4px;
  font-family: inherit;
  font-size: ${p => p.theme.fontSize.sm};
  resize: vertical;
  background: ${p => p.theme.background};

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
  }
`;

const CustomInstructionsUsed = styled(Text)`
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 4px;
  margin-top: ${space(1)};
`;

export default PRSeerAnalysis;
