import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container} from 'sentry/components/core/layout/container';
import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text/heading';
import {Text as SentryText} from 'sentry/components/core/text/text';
import {IconSettings} from 'sentry/icons';
import {formatBytesBase10SavingsAmount} from 'sentry/utils/bytes/formatBytesBase10';
import {AppSizeInsightsSidebar} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebar';
import {type AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';
import {formatPercentage} from 'sentry/views/preprod/utils/formatters';
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
    <Container
      background="primary"
      radius="md"
      padding="md"
      style={{
        marginTop: '20px',
        border: '1px solid #F0ECF3',
      }}
    >
      <Flex
        align="center"
        justify="between"
        style={{
          marginBottom: '16px',
        }}
      >
        <Heading as="h2" size="lg">
          Top insights
        </Heading>
        <Button size="sm" icon={<IconSettings />} onClick={() => setIsSidebarOpen(true)}>
          View all insights
        </Button>
      </Flex>
      <Flex direction="column" gap="2xs">
        {topInsights.map((insight, index) => (
          <InsightRow key={insight.name} isAlternating={index % 2 === 0}>
            <SentryText variant="primary" size="sm" bold>
              {insight.name}
            </SentryText>
            <Flex align="center" gap="sm">
              <SentryText variant="muted" size="sm" tabular>
                {formatBytesBase10SavingsAmount(-insight.totalSavings)}
              </SentryText>
              <SentryText
                variant="muted"
                size="sm"
                tabular
                style={{width: '64px', textAlign: 'right'}}
              >
                ({formatPercentage(-insight.percentage)})
              </SentryText>
            </Flex>
          </InsightRow>
        ))}
      </Flex>

      <AppSizeInsightsSidebar
        insights={insights}
        totalSize={totalSize}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </Container>
  );
}

const InsightRow = styled('div')<{isAlternating: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 4px 6px;
  background: ${p => (p.isAlternating ? '#F7F6F9' : 'transparent')};
  border-radius: ${p => (p.isAlternating ? '4px' : '0')};
`;
