import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconSettings} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {type AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';

interface AppSizeInsightsProps {
  insights: AppleInsightResults;
  totalSize: number;
}

interface InsightItem {
  name: string;
  percentage: number;
  savings: number;
}

export function AppSizeInsights({insights, totalSize}: AppSizeInsightsProps) {
  const insightConfigs = [
    {key: 'image_optimization', name: 'Optimize images'},
    {key: 'duplicate_files', name: 'Remove duplicate files'},
    {key: 'strip_binary', name: 'Strip Binary Symbols'},
    {key: 'main_binary_exported_symbols', name: 'Remove Symbol Metadata'},
    {key: 'large_images', name: 'Compress large images'},
    {key: 'large_videos', name: 'Compress large videos'},
    {key: 'large_audio', name: 'Compress large audio files'},
    {key: 'unnecessary_files', name: 'Remove unnecessary files'},
    {key: 'localized_strings', name: 'Optimize localized strings'},
    {key: 'localized_strings_minify', name: 'Minify localized strings'},
    {key: 'small_files', name: 'Optimize small files'},
    {key: 'loose_images', name: 'Move images to asset catalogs'},
    {key: 'hermes_debug_info', name: 'Remove Hermes debug info'},
    {key: 'audio_compression', name: 'Compress audio files'},
    {key: 'video_compression', name: 'Compress video files'},
  ] as const;

  const insightItems: InsightItem[] = insightConfigs.flatMap(config => {
    const insight = insights[config.key as keyof AppleInsightResults];
    const savings = insight?.total_savings;

    if (!savings) return [];

    return [
      {
        name: config.name,
        savings,
        percentage: (savings / totalSize) * 100,
      },
    ];
  });

  // Sort by savings amount (descending)
  insightItems.sort((a, b) => b.savings - a.savings);

  // Only show top 3 insights, show the rest in the sidebar
  const topInsights = insightItems.slice(0, 3);

  if (topInsights.length === 0) {
    return null;
  }

  return (
    <InsightsContainer>
      <Header>
        <Title>Top insights</Title>
        <Button
          size="sm"
          icon={<IconSettings />}
          onClick={() => {
            // TODO: Open sidebar with all insights
          }}
        >
          View all insights
        </Button>
      </Header>
      <InsightsList>
        {topInsights.map((insight, index) => (
          <InsightRow key={insight.name} isAlternating={index % 2 === 0}>
            <InsightName>{insight.name}</InsightName>
            <SavingsContainer>
              <SavingsAmount>-{formatBytesBase10(insight.savings)}</SavingsAmount>
              <SavingsPercentage width="64px">
                (
                {insight.percentage >= 0.1
                  ? `-${insight.percentage.toFixed(1)}%`
                  : `−${insight.percentage.toFixed(2)}%`}
                )
              </SavingsPercentage>
            </SavingsContainer>
          </InsightRow>
        ))}
      </InsightsList>
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
