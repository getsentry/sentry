import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container} from 'sentry/components/core/layout/container';
import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {IconSettings} from 'sentry/icons';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {AppSizeInsightsSidebar} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebar';
import {type AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';
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

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

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
      padding="lg"
      border="muted"
      style={{
        marginTop: '20px',
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
          <InsightRow
            key={insight.name}
            isAlternating={index % 2 === 0}
            align="center"
            justify="between"
            radius="md"
          >
            <Text variant="primary" size="sm" bold>
              {insight.name}
            </Text>
            <Flex align="center" gap="sm">
              <Text variant="muted" size="sm" tabular>
                {formatBytesBase10(insight.totalSavings)}
              </Text>
              <Text
                variant="muted"
                size="sm"
                tabular
                align="right"
                style={{width: '64px'}}
              >
                ({formatPercentage(insight.percentage / 100, 1)})
              </Text>
            </Flex>
          </InsightRow>
        ))}
      </Flex>

      <AppSizeInsightsSidebar
        insights={insights}
        totalSize={totalSize}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
    </Container>
  );
}

const InsightRow = styled(Flex)<{isAlternating: boolean}>`
  height: 22px;
  padding: 4px 6px;
  background: ${p => (p.isAlternating ? p.theme.surface200 : 'transparent')};
`;
