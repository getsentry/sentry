import {Fragment, useMemo, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {Tag} from 'sentry/components/tag';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta, Organization, Project} from 'sentry/types';
import {METRICS_DOCS_URL} from 'sentry/utils/metrics/constants';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {useBlockMetric} from 'sentry/utils/metrics/useBlockMetric';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useMetricsOnboardingSidebar} from 'sentry/views/ddm/ddmOnboarding/useMetricsOnboardingSidebar';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';
import {BlockButton} from 'sentry/views/settings/projectMetrics/blockButton';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

enum BlockingStatusTab {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

function ProjectMetrics({project, location}: Props) {
  const {data: meta, isLoading} = useMetricsMeta(
    {projects: [parseInt(project.id, 10)]},
    ['custom'],
    false
  );
  const query = decodeScalar(location.query.query, '').trim();
  const {activateSidebar} = useMetricsOnboardingSidebar();
  const [selectedTab, setSelectedTab] = useState(BlockingStatusTab.ACTIVE);

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (searchQuery: string) =>
          browserHistory.replace({
            pathname: location.pathname,
            query: {...location.query, query: searchQuery},
          }),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.pathname, location.query]
  );

  const metrics = meta.filter(
    ({mri, type, unit}) =>
      mri.includes(query) ||
      getReadableMetricType(type).includes(query) ||
      unit.includes(query)
  );

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(t('Metrics'), project.slug, false)} />
      <SettingsPageHeader
        title={t('Metrics')}
        action={
          <Button
            priority="primary"
            onClick={() => {
              Sentry.metrics.increment('ddm.add_custom_metric', 1, {
                tags: {
                  referrer: 'settings',
                },
              });
              activateSidebar();
            }}
            size="sm"
          >
            {t('Add Metric')}
          </Button>
        }
      />

      <TextBlock>
        {tct(
          `Metrics are numerical values that can track anything about your environment over time, from latency to error rates to user signups. To learn more about metrics, [link:read the docs].`,
          {
            link: <ExternalLink href={METRICS_DOCS_URL} />,
          }
        )}
      </TextBlock>

      <PermissionAlert project={project} />

      <SearchWrapper>
        <SearchBar
          placeholder={t('Search Metrics')}
          onChange={debouncedSearch}
          query={query}
        />
      </SearchWrapper>

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <TabList.Item key={BlockingStatusTab.ACTIVE}>{t('Active')}</TabList.Item>
          <TabList.Item key={BlockingStatusTab.BLOCKED}>{t('Blocked')}</TabList.Item>
        </TabList>
        <TabPanelsWrapper>
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
          <TabPanels.Item key={BlockingStatusTab.BLOCKED}>
            <MetricsTable
              metrics={metrics.filter(({blockingStatus}) => blockingStatus[0]?.isBlocked)}
              isLoading={isLoading}
              query={query}
              project={project}
            />
          </TabPanels.Item>
        </TabPanelsWrapper>
      </Tabs>
    </Fragment>
  );
}

interface MetricsTableProps {
  isLoading: boolean;
  metrics: MetricMeta[];
  project: Project;
  query: string;
}

function MetricsTable({metrics, isLoading, query, project}: MetricsTableProps) {
  const blockMetricMutation = useBlockMetric(project);
  const {hasAccess} = useAccess({access: ['project:write']});

  return (
    <StyledPanelTable
      headers={[
        t('Metric'),
        <Cell right key="type">
          {' '}
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
      {metrics.map(({mri, type, unit, blockingStatus}) => {
        const isBlocked = blockingStatus[0]?.isBlocked;
        return (
          <Fragment key={mri}>
            <Cell>
              <Link
                to={`/settings/projects/${project.slug}/metrics/${encodeURIComponent(
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
              <Tag>{unit}</Tag>
            </Cell>
            <Cell right>
              <BlockButton
                size="xs"
                hasAccess={hasAccess}
                disabled={blockMetricMutation.isLoading}
                isBlocked={isBlocked}
                aria-label={t('Block Metric')}
                message={
                  isBlocked
                    ? t('Are you sure you want to unblock this metric?')
                    : t(
                        'Are you sure you want to block this metric? It will no longer be ingested, and will not be available for use in Metrics, Alerts, or Dashboards.'
                      )
                }
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
    </StyledPanelTable>
  );
}

const TabPanelsWrapper = styled(TabPanels)`
  margin-top: ${space(2)};
`;

const SearchWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(3, minmax(115px, min-content));
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  align-items: center;
  align-self: stretch;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
`;

export default ProjectMetrics;
