import {useMemo, useState} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {FileInsightItemDiffTable} from 'sentry/views/preprod/buildComparison/main/insights/fileInsightDiffTable';
import {GroupInsightItemDiffTable} from 'sentry/views/preprod/buildComparison/main/insights/groupInsightDiffTable';
import {InsightDiffRow} from 'sentry/views/preprod/buildComparison/main/insights/insightDiffRow';
import type {
  InsightDiffItem,
  InsightStatus,
} from 'sentry/views/preprod/types/appSizeTypes';

interface InsightComparisonSectionProps {
  insightDiffItems: InsightDiffItem[];
  totalInstallSizeBytes: number;
}

const FILE_DIFF_INSIGHT_TYPES = [
  'large_images',
  'large_videos',
  'large_audio',
  'hermes_debug_info',
  'unnecessary_files',
  'webp_optimization',
  'localized_strings_minify',
  'small_files',
  'main_binary_exported_symbols',
  'audio_compression',
  'multiple_native_library_archs',
  'video_compression',
  'image_optimization',
];

const GROUP_DIFF_INSIGHT_TYPES = ['duplicate_files', 'loose_images'];

export function InsightComparisonSection({
  insightDiffItems,
  totalInstallSizeBytes,
}: InsightComparisonSectionProps) {
  const [selectedTab, setSelectedTab] = useState<'all' | InsightStatus>('all');

  const filteredInsights = useMemo(() => {
    if (selectedTab === 'all') {
      return insightDiffItems;
    }
    return insightDiffItems.filter(insight => insight.status === selectedTab);
  }, [insightDiffItems, selectedTab]);

  const statusCounts = useMemo(() => {
    return {
      all: insightDiffItems.length,
      new: insightDiffItems.filter(i => i.status === 'new').length,
      unresolved: insightDiffItems.filter(i => i.status === 'unresolved').length,
      resolved: insightDiffItems.filter(i => i.status === 'resolved').length,
    };
  }, [insightDiffItems]);

  if (insightDiffItems.length === 0) {
    return null;
  }

  return (
    <Stack gap="xl">
      <Separator orientation="horizontal" border="primary" />

      <Stack gap="md">
        <Flex direction="column" gap="md">
          <Heading as="h2">{t('Insights')}</Heading>
          <Flex align="center" gap="sm" wrap="wrap">
            <SegmentedControl value={selectedTab} onChange={setSelectedTab}>
              {statusCounts.all > 0 ? (
                <SegmentedControl.Item key="all">
                  {t('All (%s)', statusCounts.all)}
                </SegmentedControl.Item>
              ) : null}
              {statusCounts.new > 0 ? (
                <SegmentedControl.Item key="new">
                  {t('New (%s)', statusCounts.new)}
                </SegmentedControl.Item>
              ) : null}
              {statusCounts.unresolved > 0 ? (
                <SegmentedControl.Item key="unresolved">
                  {t('Unresolved (%s)', statusCounts.unresolved)}
                </SegmentedControl.Item>
              ) : null}
              {statusCounts.resolved > 0 ? (
                <SegmentedControl.Item key="resolved">
                  {t('Resolved (%s)', statusCounts.resolved)}
                </SegmentedControl.Item>
              ) : null}
            </SegmentedControl>
          </Flex>
        </Flex>

        <Stack gap="md">
          {filteredInsights.map(insight => {
            if (FILE_DIFF_INSIGHT_TYPES.includes(insight.insight_type)) {
              return (
                <InsightDiffRow
                  key={insight.insight_type}
                  insight={insight}
                  totalInstallSizeBytes={totalInstallSizeBytes}
                >
                  <FileInsightItemDiffTable fileDiffItems={insight.file_diffs} />
                </InsightDiffRow>
              );
            }
            if (GROUP_DIFF_INSIGHT_TYPES.includes(insight.insight_type)) {
              return (
                <InsightDiffRow
                  key={insight.insight_type}
                  insight={insight}
                  totalInstallSizeBytes={totalInstallSizeBytes}
                >
                  <GroupInsightItemDiffTable groupDiffItems={insight.group_diffs} />
                </InsightDiffRow>
              );
            }
            return null;
          })}
        </Stack>
      </Stack>

      <Separator orientation="horizontal" border="primary" />
    </Stack>
  );
}
