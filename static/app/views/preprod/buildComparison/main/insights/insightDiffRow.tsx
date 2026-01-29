import {useMemo, useState} from 'react';

import {Tag} from '@sentry/scraps/badge/tag';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DiffItem, InsightDiffItem} from 'sentry/views/preprod/types/appSizeTypes';
import {getInsightConfig} from 'sentry/views/preprod/utils/insightProcessing';
import {formattedSizeDiff} from 'sentry/views/preprod/utils/labelUtils';

interface InsightDiffRowProps {
  children: React.ReactNode;
  insight: InsightDiffItem;
  totalInstallSizeBytes: number;
}

export function InsightDiffRow({
  insight,
  children,
  totalInstallSizeBytes,
}: InsightDiffRowProps) {
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
      : ((Math.abs(insight.total_savings_change) / totalInstallSizeBytes) * 100).toFixed(
          2
        );

  return (
    <Container background="primary" radius="lg" padding="0" border="primary">
      <Flex direction="column" gap="0">
        <Flex align="center" justify="between" padding="xl">
          <Flex direction="column" gap="xs" flex={1}>
            <Flex align="center" gap="sm" justify="between">
              <Flex align="center" gap="sm">
                <Heading as="h3">{config.name}</Heading>
                <Flex align="center" gap="xs">
                  {statusCounts.new > 0 && (
                    <Tag variant="promotion">{t('New (%s)', statusCounts.new)}</Tag>
                  )}
                  {statusCounts.unresolved > 0 && (
                    <Tag variant="warning">
                      {t('Unresolved (%s)', statusCounts.unresolved)}
                    </Tag>
                  )}
                  {statusCounts.resolved > 0 && (
                    <Tag variant="success">
                      {t('Resolved (%s)', statusCounts.resolved)}
                    </Tag>
                  )}
                </Flex>
              </Flex>

              <Flex align="center" gap="sm">
                <Flex direction="column" align="end" gap="xs">
                  <Text>
                    {t(
                      'Potential savings: %s',
                      formattedSizeDiff(insight.total_savings_change)
                    )}{' '}
                    <Text
                      variant={insight.total_savings_change > 0 ? 'danger' : 'success'}
                    >
                      ({insight.total_savings_change > 0 ? '+' : ''}
                      {totalSavingsChangePercentage}%)
                    </Text>
                  </Text>
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
            <Text size="sm" variant="muted">
              {config.description}
            </Text>
          </Flex>
        </Flex>
        {isExpanded ? children : null}
      </Flex>
    </Container>
  );
}
