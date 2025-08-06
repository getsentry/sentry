import {useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';

import {Button} from 'sentry/components/core/button';
import {Container} from 'sentry/components/core/layout/container';
import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text/heading';
import {Text} from 'sentry/components/core/text/text';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {AppSizeInsightsSidebar} from 'sentry/views/preprod/main/insights/appSizeInsightsSidebar';
import {type ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

interface AppSizeInsightsProps {
  processedInsights: ProcessedInsight[];
}

export function AppSizeInsights({processedInsights}: AppSizeInsightsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isSidebarOpen = searchParams.get('insights') === 'open';

  const openSidebar = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('insights', 'open');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const closeSidebar = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('insights');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Only show top 3 insights, show the rest in the sidebar
  const topInsights = processedInsights.slice(0, 3);

  return (
    <Container background="primary" radius="md" padding="lg" border="muted">
      <Flex
        align="center"
        justify="between"
        style={{
          marginBottom: '16px',
        }}
      >
        <Heading as="h2" size="lg">
          {t('Top insights')}
        </Heading>
        <Button size="sm" icon={<IconSettings />} onClick={openSidebar}>
          {t('View all insights')}
        </Button>
      </Flex>
      <Flex
        direction="column"
        gap="2xs"
        css={theme => ({
          '& > :nth-child(odd)': {
            backgroundColor: theme.backgroundSecondary,
          },
        })}
      >
        {topInsights.map(insight => (
          <Flex
            key={insight.name}
            align="center"
            justify="between"
            radius="md"
            height="22px"
            padding="xs sm"
          >
            <Text variant="accent" size="sm" bold>
              {insight.name}
            </Text>
            <Flex align="center" gap="sm">
              <Text variant="muted" size="sm" tabular>
                -{formatBytesBase10(insight.totalSavings)}
              </Text>
              <Text
                variant="muted"
                size="sm"
                tabular
                align="right"
                style={{width: '64px'}}
              >
                (-{formatPercentage(insight.percentage / 100, 1)})
              </Text>
            </Flex>
          </Flex>
        ))}
      </Flex>

      <AppSizeInsightsSidebar
        processedInsights={processedInsights}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />
    </Container>
  );
}
