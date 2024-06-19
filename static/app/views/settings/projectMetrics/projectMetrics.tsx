import {Fragment, useMemo, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Tag from 'sentry/components/badge/tag';
import {Button, LinkButton} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconArrow, IconDelete, IconEdit, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricMeta} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  DEFAULT_METRICS_CARDINALITY_LIMIT,
  METRICS_DOCS_URL,
} from 'sentry/utils/metrics/constants';
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {useBlockMetric} from 'sentry/utils/metrics/useBlockMetric';
import {useMetricsCardinality} from 'sentry/utils/metrics/useMetricsCardinality';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useMetricsOnboardingSidebar} from 'sentry/views/metrics/ddmOnboarding/useMetricsOnboardingSidebar';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';
import {BlockButton} from 'sentry/views/settings/projectMetrics/blockButton';
import {CardinalityLimit} from 'sentry/views/settings/projectMetrics/cardinalityLimit';
import {
  MetricsExtractionRuleEditModal,
  modalCss,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';
import {
  type MetricsExtractionRule,
  useDeleteMetricsExtractionRules,
  useMetricsExtractionRules,
} from 'sentry/views/settings/projectMetrics/utils/api';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

enum BlockingStatusTab {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

type MetricWithCardinality = MetricMeta & {cardinality: number};

function ProjectMetrics({project, location}: Props) {
  const organization = useOrganization();
  const metricsMeta = useMetricsMeta(
    {projects: [parseInt(project.id, 10)]},
    ['custom'],
    false
  );

  const metricsCardinality = useMetricsCardinality({
    project,
  });

  const sortedMeta = useMemo(() => {
    if (!metricsMeta.data) {
      return [];
    }

    if (!metricsCardinality.data) {
      return metricsMeta.data.map(meta => ({...meta, cardinality: 0}));
    }

    return metricsMeta.data
      .map(({mri, ...rest}) => {
        return {
          mri,
          cardinality: metricsCardinality.data[mri] ?? 0,
          ...rest,
        };
      })
      .sort((a, b) => {
        return b.cardinality - a.cardinality;
      }) as MetricWithCardinality[];
  }, [metricsCardinality.data, metricsMeta.data]);

  const query = decodeScalar(location.query.query, '').trim();

  const metrics = sortedMeta.filter(
    ({mri, type, unit}) =>
      mri.includes(query) ||
      getReadableMetricType(type).includes(query) ||
      unit.includes(query)
  );

  const isLoading = metricsMeta.isLoading || metricsCardinality.isLoading;

  const navigate = useNavigate();
  const debouncedSearch = useMemo(
    () =>
      debounce(
        (searchQuery: string) =>
          navigate({
            pathname: location.pathname,
            query: {...location.query, query: searchQuery},
          }),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.pathname, location.query, navigate]
  );

  const {activateSidebar} = useMetricsOnboardingSidebar();
  const [selectedTab, setSelectedTab] = useState(BlockingStatusTab.ACTIVE);

  const hasExtractionRules = hasCustomMetricsExtractionRules(organization);

  const extractionRulesQuery = useMetricsExtractionRules(organization.slug, project.slug);
  const deleteExtractionRulesMutation = useDeleteMetricsExtractionRules(
    organization.slug,
    project.slug
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

      <CardinalityLimit project={project} />

      {hasExtractionRules && (
        <Fragment>
          <ExtractionRulesSearchWrapper>
            <h6>{t('Metric Extraction Rules')}</h6>
            <LinkButton
              to={`/settings/projects/${project.slug}/metrics/extract-metric`}
              priority="primary"
              size="sm"
            >
              {t('Add Extraction Rule')}
            </LinkButton>
          </ExtractionRulesSearchWrapper>
          <MetricsExtractionTable
            isLoading={extractionRulesQuery.isLoading}
            onDelete={rule =>
              openConfirmModal({
                onConfirm: () =>
                  deleteExtractionRulesMutation.mutate(
                    {metricsExtractionRules: [rule]},
                    {
                      onSuccess: () => {
                        addSuccessMessage(t('Metric extraction rule deleted'));
                      },
                      onError: () => {
                        addErrorMessage(t('Failed to delete metric extraction rule'));
                      },
                    }
                  ),
                message: t('Are you sure you want to delete this extraction rule?'),
                confirmText: t('Delete Extraction Rule'),
              })
            }
            onEdit={rule => {
              openModal(
                props => (
                  <MetricsExtractionRuleEditModal
                    project={project}
                    metricExtractionRule={rule}
                    {...props}
                  />
                ),
                {modalCss}
              );
            }}
            extractionRules={extractionRulesQuery.data ?? []}
          />
        </Fragment>
      )}

      <SearchWrapper>
        <h6>{t('Emitted Metrics')}</h6>
        <SearchBar
          placeholder={t('Search Metrics')}
          onChange={debouncedSearch}
          query={query}
          size="sm"
        />
      </SearchWrapper>

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <TabList.Item key={BlockingStatusTab.ACTIVE}>{t('Active')}</TabList.Item>
          <TabList.Item key={BlockingStatusTab.DISABLED}>{t('Disabled')}</TabList.Item>
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
          <TabPanels.Item key={BlockingStatusTab.DISABLED}>
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

interface MetricsExtractionTableProps {
  extractionRules: MetricsExtractionRule[];
  isLoading: boolean;
  onDelete: (rule: MetricsExtractionRule) => void;
  onEdit: (rule: MetricsExtractionRule) => void;
}

function MetricsExtractionTable({
  extractionRules,
  isLoading,
  onDelete,
  onEdit,
}: MetricsExtractionTableProps) {
  return (
    <ExtractionRulesPanelTable
      headers={[
        <Cell key="spanAttribute">
          <IconArrow size="xs" direction="down" />
          {t('Span attribute')}
        </Cell>,
        <Cell right key="type">
          {t('Type')}
        </Cell>,
        <Cell right key="unit">
          {t('Unit')}
        </Cell>,
        <Cell right key="filters">
          {t('Filters')}
        </Cell>,
        <Cell right key="tags">
          {t('Tags')}
        </Cell>,
        <Cell right key="actions">
          {t('Actions')}
        </Cell>,
      ]}
      emptyMessage={t('You have not created any extraction rules yet.')}
      isEmpty={extractionRules.length === 0}
      isLoading={isLoading}
    >
      {extractionRules
        .toSorted((a, b) => a?.spanAttribute?.localeCompare(b?.spanAttribute))
        .map(rule => (
          <Fragment key={rule.spanAttribute + rule.type + rule.unit}>
            <Cell>{rule.spanAttribute}</Cell>
            <Cell right>
              <Tag>{getReadableMetricType(rule.type)}</Tag>
            </Cell>
            <Cell right>
              <Tag>{rule.unit}</Tag>
            </Cell>
            <Cell right>
              {rule.conditions.length ? (
                <Button priority="link" onClick={() => onEdit(rule)}>
                  {rule.conditions.length}
                </Button>
              ) : (
                <NoValue>{t('(none)')}</NoValue>
              )}
            </Cell>
            <Cell right>
              {rule.tags.length ? (
                <Button priority="link" onClick={() => onEdit(rule)}>
                  {rule.tags.length}
                </Button>
              ) : (
                <NoValue>{t('(none)')}</NoValue>
              )}
            </Cell>
            <Cell right>
              <Button
                aria-label={t('Delete rule')}
                size="xs"
                icon={<IconDelete />}
                borderless
                onClick={() => onDelete(rule)}
              />
              <Button
                aria-label={t('Edit rule')}
                size="xs"
                icon={<IconEdit />}
                borderless
                onClick={() => onEdit(rule)}
              />
            </Cell>
          </Fragment>
        ))}
    </ExtractionRulesPanelTable>
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
  const {hasAccess} = useAccess({access: ['project:write'], project});
  const cardinalityLimit =
    project.relayCustomMetricCardinalityLimit ?? DEFAULT_METRICS_CARDINALITY_LIMIT;

  return (
    <MetricsPanelTable
      headers={[
        t('Metric'),
        <Cell right key="cardinality">
          <IconArrow size="xs" direction="down" />

          {t('Cardinality')}
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
        const isBlocked = blockingStatus[0]?.isBlocked;
        const isCardinalityLimited = cardinality >= cardinalityLimit;
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
              {isCardinalityLimited && (
                <Tooltip
                  title={tct(
                    'The tag cardinality of this metric exceeded our limit of [cardinalityLimit], which led to the data being dropped',
                    {cardinalityLimit}
                  )}
                >
                  <StyledIconWarning size="sm" color="red300" />
                </Tooltip>
              )}
              {cardinality}
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

const TabPanelsWrapper = styled(TabPanels)`
  margin-top: ${space(2)};
`;

const SearchWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: ${space(4)};
  margin-bottom: ${space(0)};

  & > h6 {
    margin: 0;
  }
`;

const ExtractionRulesSearchWrapper = styled(SearchWrapper)`
  margin-bottom: ${space(1)};
`;

const MetricsPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(4, min-content);
`;

const ExtractionRulesPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(5, min-content);
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

const NoValue = styled('span')`
  color: ${p => p.theme.subText};
`;

export default ProjectMetrics;
