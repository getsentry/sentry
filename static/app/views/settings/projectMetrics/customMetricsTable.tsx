import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import Link from 'sentry/components/links/link';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, isExtractedCustomMetric} from 'sentry/utils/metrics/mri';
import {useBlockMetric} from 'sentry/utils/metrics/useBlockMetric';
import {useCardinalityLimitedMetricVolume} from 'sentry/utils/metrics/useCardinalityLimitedMetricVolume';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import useOrganization from 'sentry/utils/useOrganization';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';
import {BlockButton} from 'sentry/views/settings/projectMetrics/blockButton';
import {useSearchQueryParam} from 'sentry/views/settings/projectMetrics/utils/useSearchQueryParam';

type Props = {
  project: Project;
};

enum BlockingStatusTab {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

type MetricWithCardinality = MetricMeta & {cardinality: number};

export function CustomMetricsTable({project}: Props) {
  const [selectedTab, setSelectedTab] = useState(BlockingStatusTab.ACTIVE);
  const [query, setQuery] = useSearchQueryParam('metricsQuery');

  const metricsMeta = useMetricsMeta(
    {projects: [parseInt(project.id, 10)]},
    ['custom'],
    false
  );

  const metricsCardinality = useCardinalityLimitedMetricVolume({
    projects: [parseInt(project.id, 10)],
  });

  const isLoading = metricsMeta.isLoading || metricsCardinality.isPending;

  const sortedMeta = useMemo(() => {
    if (!metricsMeta.data) {
      return [];
    }

    // Do not show internal extracted metrics in this table
    const filteredMeta = metricsMeta.data.filter(meta => !isExtractedCustomMetric(meta));
    if (!metricsCardinality.data) {
      return filteredMeta.map(meta => ({...meta, cardinality: 0}));
    }

    return filteredMeta
      .map(({mri, ...rest}) => {
        return {
          mri,
          cardinality: metricsCardinality.data[mri] ?? 0,
          ...rest,
        };
      })
      .sort((a, b) => {
        // First sort by cardinality (descending)
        if (b.cardinality !== a.cardinality) {
          return b.cardinality - a.cardinality;
        }
        // If cardinality is the same, sort by name (ascending)
        return a.mri.localeCompare(b.mri);
      }) as MetricWithCardinality[];
  }, [metricsCardinality.data, metricsMeta.data]);

  const metrics = sortedMeta.filter(
    ({mri, type, unit}) =>
      mri.includes(query) ||
      getReadableMetricType(type).includes(query) ||
      unit.includes(query)
  );

  return (
    <Fragment>
      <SearchWrapper>
        <Title>
          <h6>{t('Custom Metrics')}</h6>
        </Title>
        <SearchBar
          placeholder={t('Search Metrics')}
          onChange={setQuery}
          query={query}
          size="sm"
        />
      </SearchWrapper>

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <TabList.Item key={BlockingStatusTab.ACTIVE}>{t('Active')}</TabList.Item>
          <TabList.Item key={BlockingStatusTab.DISABLED}>{t('Disabled')}</TabList.Item>
        </TabList>
        <TabPanels>
          <TabPanels.Item key={BlockingStatusTab.ACTIVE}>
            <MetricsTable
              metrics={metrics.filter(
                ({blockingStatus}) => !blockingStatus[0]?.isBlocked
              )}
              isLoading={isLoading}
              query={query}
              project={project}
            />
          </TabPanels.Item>
          <TabPanels.Item key={BlockingStatusTab.DISABLED}>
            <MetricsTable
              metrics={metrics.filter(({blockingStatus}) => blockingStatus[0]?.isBlocked)}
              isLoading={isLoading}
              query={query}
              project={project}
            />
          </TabPanels.Item>
        </TabPanels>
      </Tabs>
    </Fragment>
  );
}

interface MetricsTableProps {
  isLoading: boolean;
  metrics: MetricWithCardinality[];
  project: Project;
  query: string;
}

function MetricsTable({metrics, isLoading, query, project}: MetricsTableProps) {
  const blockMetricMutation = useBlockMetric(project);
  const organization = useOrganization();
  const {hasAccess} = useAccess({access: ['project:write'], project});

  return (
    <MetricsPanelTable
      headers={[
        <Cell key="metric">
          <IconArrow size="xs" direction="down" />
          {t('Metric')}
        </Cell>,
        <Cell right key="type">
          {t('Type')}
        </Cell>,
        <Cell right key="unit">
          {t('Unit')}
        </Cell>,
        <Cell right key="actions">
          {t('Actions')}
        </Cell>,
      ]}
      emptyMessage={
        query
          ? t('No metrics match the query.')
          : t('There are no custom metrics to display.')
      }
      isEmpty={metrics.length === 0}
      isLoading={isLoading}
    >
      {metrics.map(({mri, type, unit, cardinality, blockingStatus}) => {
        const isBlocked = blockingStatus[0]?.isBlocked!;
        const isCardinalityLimited = cardinality > 0;
        return (
          <Fragment key={mri}>
            <Cell>
              {isCardinalityLimited && (
                <Tooltip
                  title={t(
                    'The tag cardinality of this metric exceeded the limit, causing the data to be dropped.'
                  )}
                >
                  <StyledIconWarning size="sm" color="yellow300" />
                </Tooltip>
              )}
              <Link
                to={`/settings/${organization.slug}/projects/${project.slug}/metrics/${encodeURIComponent(
                  mri
                )}`}
              >
                {middleEllipsis(formatMRI(mri), 65, /\.|-|_/)}
              </Link>
            </Cell>
            <Cell right>
              <Tag>{getReadableMetricType(type)}</Tag>
            </Cell>
            <Cell right>
              <Tag>{unit ?? 'none'}</Tag>
            </Cell>
            <Cell right>
              <BlockButton
                size="xs"
                hasAccess={hasAccess}
                disabled={blockMetricMutation.isPending}
                isBlocked={isBlocked}
                blockTarget="metric"
                onConfirm={() => {
                  blockMetricMutation.mutate({
                    mri,
                    operationType: isBlocked ? 'unblockMetric' : 'blockMetric',
                  });
                }}
              />
            </Cell>
          </Fragment>
        );
      })}
    </MetricsPanelTable>
  );
}

const SearchWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(1)};
  margin-top: ${space(4)};
  margin-bottom: 0;

  & > h6 {
    margin: 0;
  }
`;

const MetricsPanelTable = styled(PanelTable)`
  margin-top: ${space(2)};
  grid-template-columns: 1fr repeat(3, min-content);
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: ${space(0.5)};
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
`;

const StyledIconWarning = styled(IconWarning)`
  margin-top: ${space(0.5)};
  &:hover {
    cursor: pointer;
  }
`;

const Title = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(0.5)};
  margin-bottom: ${space(3)};
  & > h6 {
    margin: 0;
  }
`;
