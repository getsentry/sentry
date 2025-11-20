import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge/tag';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {SizeCompareItemDiffTable} from 'sentry/views/preprod/buildComparison/main/sizeCompareItemDiffTable';
import type {
  DiffItem,
  InsightDiffItem,
  InsightStatus,
} from 'sentry/views/preprod/types/appSizeTypes';
import {INSIGHT_CONFIGS} from 'sentry/views/preprod/utils/insightProcessing';

interface InsightComparisonSectionProps {
  insightDiffItems: InsightDiffItem[];
}

function getInsightConfig(insightType: string): {description: string; name: string} {
  return (
    INSIGHT_CONFIGS.find(config => config.key === insightType) ?? {
      name: insightType,
      description: t('No description available'),
    }
  );
}

interface InsightRowProps {
  insight: InsightDiffItem;
}

function InsightRow({insight}: InsightRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getInsightConfig(insight.insight_type);

  const allDiffItems: DiffItem[] = useMemo(
    () => [...insight.file_diffs, ...insight.group_diffs],
    [insight.file_diffs, insight.group_diffs]
  );

  const statusCounts = useMemo(() => {
    const newCount = insight.status === 'new' ? allDiffItems.length : 0;
    const unresolvedCount =
      insight.status === 'unresolved'
        ? allDiffItems.filter(item => item.type === 'added' || item.type === 'increased')
            .length
        : 0;
    const resolvedCount =
      insight.status === 'resolved'
        ? allDiffItems.length
        : insight.status === 'unresolved'
          ? allDiffItems.filter(
              item => item.type === 'removed' || item.type === 'decreased'
            ).length
          : 0;

    return {new: newCount, unresolved: unresolvedCount, resolved: resolvedCount};
  }, [insight.status, allDiffItems]);

  const totalSavingsChangePercentage =
    insight.total_savings_change === 0
      ? '0.00'
      : ((Math.abs(insight.total_savings_change) / 1000000) * 100).toFixed(2);

  return (
    <Container background="primary" radius="lg" padding="0" border="primary">
      <Flex direction="column" gap="0">
        <Flex align="center" justify="between" padding="xl">
          <Flex direction="column" gap="sm" style={{flex: 1}}>
            <Flex align="center" gap="sm">
              <Heading as="h3">{config.name}</Heading>
              <Flex align="center" gap="xs">
                {statusCounts.new > 0 && (
                  <Tag type="promotion">{t('New (%s)', statusCounts.new)}</Tag>
                )}
                {statusCounts.unresolved > 0 && (
                  <Tag type="warning">
                    {t('Unresolved (%s)', statusCounts.unresolved)}
                  </Tag>
                )}
                {statusCounts.resolved > 0 && (
                  <Tag type="success">{t('Resolved (%s)', statusCounts.resolved)}</Tag>
                )}
              </Flex>
            </Flex>
            <Text size="sm" variant="muted">
              {config.description}
            </Text>
          </Flex>
          <Flex align="center" gap="md">
            <Flex direction="column" align="end" gap="xs">
              <Text bold>
                {t(
                  'Potential savings: %s',
                  formatBytesBase10(insight.total_savings_change)
                )}
              </Text>
              <SavingsPercentage savingsChange={insight.total_savings_change}>
                {insight.total_savings_change > 0 ? '+' : ''}
                {totalSavingsChangePercentage}%
              </SavingsPercentage>
            </Flex>
            <Button
              priority="transparent"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? t('Collapse insight') : t('Expand insight')}
            >
              <IconChevron
                direction={isExpanded ? 'up' : 'down'}
                size="sm"
                style={{
                  transition: 'transform 0.2s ease',
                }}
              />
            </Button>
          </Flex>
        </Flex>
        {isExpanded && allDiffItems.length > 0 && (
          <SizeCompareItemDiffTable
            diffItems={allDiffItems}
            originalItemCount={allDiffItems.length}
            disableHideSmallChanges={() => {}}
          />
        )}
      </Flex>
    </Container>
  );
}

export function InsightComparisonSection({
  insightDiffItems,
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
          {filteredInsights.map(insight => (
            <InsightRow key={insight.insight_type} insight={insight} />
          ))}
        </Stack>
      </Stack>

      <Separator orientation="horizontal" border="primary" />
    </Stack>
  );
}

const SavingsPercentage = styled(Text)<{savingsChange: number}>`
  color: ${p => (p.savingsChange > 0 ? p.theme.dangerText : p.theme.successText)};
  font-weight: ${p => p.theme.fontWeight.normal};
`;
