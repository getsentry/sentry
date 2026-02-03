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
  DiffItem,
  DiffType,
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
  'large_audios',
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
  'strip_binary',
];

const GROUP_DIFF_INSIGHT_TYPES = ['duplicate_files', 'loose_images'];

const UNRESOLVED_ITEM_TYPES = new Set<DiffType>(['added', 'increased']);
const RESOLVED_ITEM_TYPES = new Set<DiffType>(['removed', 'decreased']);

function sumDiffItems(diffItems: DiffItem[]): number {
  return diffItems.reduce((total, item) => total + item.size_diff, 0);
}

function filterDiffItems(
  diffItems: DiffItem[],
  allowedTypes: Set<DiffType>,
  fallbackType: DiffType
): DiffItem[] {
  return diffItems.flatMap(item => {
    const children = item.diff_items ?? [];
    if (children.length === 0) {
      return allowedTypes.has(item.type) ? [item] : [];
    }

    const filteredChildren = children.filter(child => allowedTypes.has(child.type));
    if (filteredChildren.length === 0) {
      return [];
    }

    const firstType = filteredChildren[0]!.type;
    const inferredType = filteredChildren.every(child => child.type === firstType)
      ? firstType
      : fallbackType;

    return [
      {
        ...item,
        type: inferredType,
        size_diff: sumDiffItems(filteredChildren),
        diff_items: filteredChildren,
      },
    ];
  });
}

function filterInsightByLineItemTypes(
  insight: InsightDiffItem,
  allowedTypes: Set<DiffType>,
  fallbackType: DiffType
): InsightDiffItem | null {
  const filteredFileDiffs = filterDiffItems(
    insight.file_diffs,
    allowedTypes,
    fallbackType
  );
  const filteredGroupDiffs = filterDiffItems(
    insight.group_diffs,
    allowedTypes,
    fallbackType
  );
  const filteredItems = [...filteredFileDiffs, ...filteredGroupDiffs];

  if (filteredItems.length === 0) {
    return null;
  }

  return {
    ...insight,
    file_diffs: filteredFileDiffs,
    group_diffs: filteredGroupDiffs,
    total_savings_change: sumDiffItems(filteredItems),
  };
}

export function InsightComparisonSection({
  insightDiffItems,
  totalInstallSizeBytes,
}: InsightComparisonSectionProps) {
  type InsightTab = 'all' | InsightStatus;
  const [selectedTab, setSelectedTab] = useState<InsightTab>('all');

  const tabbedInsights = useMemo(() => {
    const byTab: Record<InsightTab, InsightDiffItem[]> = {
      all: [],
      new: [],
      unresolved: [],
      resolved: [],
    };

    for (const insight of insightDiffItems) {
      byTab.all.push(insight);

      if (insight.status === 'new') {
        byTab.new.push(insight);
      }

      if (insight.status === 'unresolved') {
        const unresolvedInsight = filterInsightByLineItemTypes(
          insight,
          UNRESOLVED_ITEM_TYPES,
          'increased'
        );
        if (unresolvedInsight) {
          byTab.unresolved.push(unresolvedInsight);
        }
      }

      const resolvedInsight = filterInsightByLineItemTypes(
        insight,
        RESOLVED_ITEM_TYPES,
        'decreased'
      );
      if (resolvedInsight) {
        byTab.resolved.push(resolvedInsight);
      }
    }

    return {
      byTab,
      counts: {
        all: byTab.all.length,
        new: byTab.new.length,
        unresolved: byTab.unresolved.length,
        resolved: byTab.resolved.length,
      },
    };
  }, [insightDiffItems]);

  const filteredInsights = tabbedInsights.byTab[selectedTab];
  const statusCounts = tabbedInsights.counts;

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
