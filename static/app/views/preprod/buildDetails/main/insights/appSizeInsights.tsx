import {useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import useOrganization from 'sentry/utils/useOrganization';
import {AppSizeInsightsSidebar} from 'sentry/views/preprod/buildDetails/main/insights/appSizeInsightsSidebar';
import {formatUpside} from 'sentry/views/preprod/buildDetails/main/insights/appSizeInsightsSidebarRow';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import {type ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

interface AppSizeInsightsProps {
  processedInsights: ProcessedInsight[];
  platform?: Platform;
  projectType?: string | null;
}

export function AppSizeInsights({
  processedInsights,
  platform,
  projectType,
}: AppSizeInsightsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isSidebarOpen = searchParams.get('insights') === 'open';
  const organization = useOrganization();

  const openSidebar = useCallback(() => {
    trackAnalytics('preprod.builds.details.open_insights_sidebar', {
      organization,
      platform: platform ?? null,
      source: 'insight_table',
      project_type: projectType,
    });
    const newParams = new URLSearchParams(searchParams);
    newParams.set('insights', 'open');
    setSearchParams(newParams);
  }, [organization, platform, projectType, searchParams, setSearchParams]);

  const closeSidebar = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('insights');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const hasInsights = processedInsights.length > 0;
  // Only show top 5 insights, show the rest in the sidebar
  const topInsights = processedInsights.slice(0, 5);

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
        {hasInsights && (
          <Button size="sm" icon={<IconSettings />} onClick={openSidebar}>
            {t('View insight details')}
          </Button>
        )}
      </Flex>
      <Flex
        direction="column"
        gap="2xs"
        css={theme => ({
          '& > :nth-child(odd)': {
            backgroundColor: theme.tokens.background.secondary,
          },
        })}
      >
        {topInsights.map(insight => (
          <Flex
            key={insight.key}
            align="center"
            justify="between"
            radius="md"
            height="22px"
            padding="xs sm"
          >
            <Text size="sm" bold>
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
                ({formatUpside(insight.percentage / 100)})
              </Text>
            </Flex>
          </Flex>
        ))}
        {!hasInsights && (
          <Flex
            padding="lg"
            radius="md"
            background="primary"
            align="center"
            justify="center"
          >
            <Text size="sm" bold>
              {t('Your app looks good! No insights were found.')}
            </Text>
          </Flex>
        )}
      </Flex>

      <AppSizeInsightsSidebar
        processedInsights={processedInsights}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        platform={platform}
        projectType={projectType}
      />
    </Container>
  );
}
