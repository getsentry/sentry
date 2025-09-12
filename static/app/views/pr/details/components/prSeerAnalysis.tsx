import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Text} from 'sentry/components/core/text/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconSeer} from 'sentry/icons';
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

type AnalysisType = 'custom' | 'tests' | 'explain';

interface SeerAnalysis {
  analysis: string;
  insights: Array<{
    description: string;
    title: string;
    type: 'suggestion' | 'warning' | 'info';
  }>;
  status: 'pending' | 'completed' | 'error';
  type: AnalysisType;
  custom_instructions?: string;
}

function PRSeerAnalysis({repoName: _repoName, prId: _prId, issues}: PRSeerAnalysisProps) {
  const _organization = useOrganization();
  const _api = useApi();

  const [analysis, setAnalysis] = useState<SeerAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('custom');
  const [customInstructions, setCustomInstructions] = useState('');

  const runSeerAnalysis = useCallback(
    async (type: AnalysisType, instructions?: string) => {
      if (type !== 'custom' && type !== 'explain' && issues.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        let analysisContent = '';
        let insights: SeerAnalysis['insights'] = [];

        // Generate different content based on analysis type
        switch (type) {
          case 'custom': {
            const customPrompt = instructions || customInstructions || 'Analyze this PR';
            analysisContent = `Custom Analysis: ${customPrompt}\n\nBased on your request, here's the analysis of the PR changes. The modifications appear to focus on improving the user interface and functionality.`;
            insights = [
              {
                title: 'Custom Analysis Result',
                description: 'Analysis completed based on your specific instructions.',
                type: 'info' as const,
              },
            ];
            break;
          }
          case 'tests': {
            analysisContent = `Test Generation Analysis:\n\nBased on the PR changes, here are recommended tests to add:\n\n1. Unit tests for new components\n2. Integration tests for modified workflows\n3. Edge case testing for error handling`;
            insights = [
              {
                title: 'Suggested Unit Tests',
                description:
                  'Add tests for the new snapshot components and their vertical layout functionality.',
                type: 'suggestion' as const,
              },
              {
                title: 'Integration Testing',
                description: 'Test the tab switching behavior and URL state management.',
                type: 'suggestion' as const,
              },
            ];
            break;
          }
          case 'explain': {
            analysisContent = `PR Change Summary:\n\nThis PR improves the snapshot testing interface with the following key changes:\n\n• Replaced tab navigation with a modern segmented control\n• Redesigned snapshot cards to use vertical layout\n• Added URL state management for tab persistence\n• Improved spacing and visual design\n• Added proper error handling for missing image data`;
            insights = [
              {
                title: 'UI/UX Improvements',
                description:
                  'Enhanced the snapshot testing interface with better navigation and card layout.',
                type: 'info' as const,
              },
              {
                title: 'Technical Improvements',
                description:
                  'Added URL state persistence and better error handling for a more robust user experience.',
                type: 'info' as const,
              },
            ];
            break;
          }
          default:
            break;
        }

        const aggregatedAnalysis: SeerAnalysis = {
          analysis: analysisContent,
          insights,
          type,
          custom_instructions:
            type === 'custom' ? instructions || customInstructions : undefined,
          status: 'completed',
        };

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        setAnalysis(aggregatedAnalysis);
      } catch (err) {
        setError(t('Failed to analyze with Seer. Please try again.'));
      } finally {
        setLoading(false);
      }
    },
    [issues, customInstructions]
  );

  const handleRunAnalysis = useCallback(() => {
    runSeerAnalysis(analysisType, customInstructions);
  }, [runSeerAnalysis, analysisType, customInstructions]);

  // Remove auto-run behavior - let user choose what they want

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
        <HeaderContent justify="flex-start" align="center">
          <HeaderText align="center" gap="md">
            <IconSeer size="sm" />
            {t('Seer Analysis')}
          </HeaderText>
        </HeaderContent>
      </PanelHeader>

      <StyledPanelBody>
        <ControlsSection direction="column" gap="md">
          <SegmentedControl
            aria-label={t('Analysis type')}
            value={analysisType}
            onChange={setAnalysisType}
          >
            <SegmentedControl.Item key="custom">
              {t('Custom analysis')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="tests">
              {t('Generate tests')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="explain">
              {t('Explain changes')}
            </SegmentedControl.Item>
          </SegmentedControl>

          <CustomInputSection direction="column" gap="sm">
            <Text as="label" bold size="sm">
              {analysisType === 'custom'
                ? t('What would you like to analyze?')
                : t('Additional instructions (optional):')}
            </Text>
            <InstructionsTextarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder={
                analysisType === 'custom'
                  ? t(
                      'Ask about code quality, security concerns, performance, or anything else...'
                    )
                  : analysisType === 'tests'
                    ? t('Specify test types, frameworks, or focus areas...')
                    : t('Ask for specific aspects of the changes to explain...')
              }
            />
          </CustomInputSection>

          <Button
            priority="primary"
            size="sm"
            onClick={handleRunAnalysis}
            disabled={analysisType === 'custom' && !customInstructions.trim()}
          >
            {analysisType === 'custom' && t('Run Custom Analysis')}
            {analysisType === 'tests' && t('Generate Test Suggestions')}
            {analysisType === 'explain' && t('Explain Changes')}
          </Button>
        </ControlsSection>

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
        ) : null}
      </StyledPanelBody>
    </SeerPanel>
  );
}

const SeerPanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: 0;
`;

const HeaderContent = styled(Flex)`
  width: 100%;
`;

const HeaderText = styled(Flex)`
  font-weight: 600;
`;

const LoadingContainer = styled(Flex)`
  padding: ${space(3)};
`;

const ErrorMessage = styled(Text)`
  padding: ${space(2)};
  background: ${p => p.theme.red100};
  border: 1px solid ${p => p.theme.red200};
  border-radius: 4px;
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

const ControlsSection = styled(Flex)`
  padding: ${space(2)};
`;

const CustomInputSection = styled(Flex)`
  margin-top: ${space(1)};
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
