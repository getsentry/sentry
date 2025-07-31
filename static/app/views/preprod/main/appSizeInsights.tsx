import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconSettings} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {AppSizeInsightsSidebar} from 'sentry/views/preprod/main/appSizeInsightsSidebar';
import {type AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';
import {
  formatPercentage,
  formatSavingsAmount,
} from 'sentry/views/preprod/utils/formatters';
import {
  type ProcessedInsight,
  processInsights,
} from 'sentry/views/preprod/utils/insightProcessing';

interface AppSizeInsightsProps {
  insights: AppleInsightResults;
  totalSize: number;
}

export function AppSizeInsights({insights, totalSize}: AppSizeInsightsProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!totalSize || totalSize <= 0) {
    return null;
  }

  const insightItems: ProcessedInsight[] = processInsights(insights, totalSize);

  // Only show top 3 insights, show the rest in the sidebar
  const topInsights = insightItems.slice(0, 3);

  if (topInsights.length === 0) {
    return null;
  }

  return (
    <InsightsContainer>
      <Header>
        <Title>Top insights</Title>
        <Button size="sm" icon={<IconSettings />} onClick={() => setIsSidebarOpen(true)}>
          View all insights
        </Button>
      </Header>
      <InsightsList>
        {topInsights.map((insight, index) => (
          <InsightRow key={insight.name} isAlternating={index % 2 === 0}>
            <InsightName>{insight.name}</InsightName>
            <SavingsContainer>
              <SavingsAmount>−{formatSavingsAmount(insight.totalSavings)}</SavingsAmount>
              <SavingsPercentage width="64px">
                ({formatPercentage(-insight.percentage)})
              </SavingsPercentage>
            </SavingsContainer>
          </InsightRow>
        ))}
      </InsightsList>

      <AppSizeInsightsSidebar
        insights={insights}
        totalSize={totalSize}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </InsightsContainer>
  );
}

const InsightsContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin-top: ${space(3)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const Title = styled('h3')`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: ${p => p.theme.textColor};
`;

const InsightsList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InsightRow = styled('div')<{isAlternating: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 4px 6px;
  background: ${p => (p.isAlternating ? '#F7F6F9' : 'transparent')};
  border-radius: ${p => (p.isAlternating ? '4px' : '0')};
`;

const InsightName = styled('span')`
  color: ${p => p.theme.purple300};
  font-family: 'Rubik', sans-serif;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  font-variant-numeric: lining-nums tabular-nums;
`;

const SavingsContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SavingsText = styled('span')<{width?: string}>`
  font-family: 'Rubik', sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0;
  text-align: right;
  font-variant-numeric: lining-nums tabular-nums;
  width: ${p => p.width || 'auto'};
`;

const SavingsAmount = styled(SavingsText)`
  color: ${p => p.theme.gray400};
`;

const SavingsPercentage = styled(SavingsText)`
  color: ${p => p.theme.gray400};
`;
