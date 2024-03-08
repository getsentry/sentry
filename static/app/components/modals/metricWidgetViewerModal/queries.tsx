import {useMemo} from 'react';
import styled from '@emotion/styled';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconAdd, IconClose, IconEllipsis, IconSettings, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isCustomMetric} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import type {DashboardMetricsQuery} from 'sentry/views/dashboards/metrics/types';
import {getCreateAlert} from 'sentry/views/ddm/metricQueryContextMenu';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';

interface Props {
  addQuery: () => void;
  handleChange: (data: Partial<DashboardMetricsQuery>, index: number) => void;
  metricWidgetQueries: DashboardMetricsQuery[];
  removeQuery: (index: number) => void;
}

export function Queries({
  metricWidgetQueries,
  handleChange,
  addQuery,
  removeQuery,
}: Props) {
  const {selection} = usePageFilters();
  const showQuerySymbols = metricWidgetQueries.length > 1;

  return (
    <QueriesWrapper>
      {metricWidgetQueries.map((query, index) => (
        <QueryWrapper key={index} hasQuerySymbol={showQuerySymbols}>
          {showQuerySymbols && (
            <StyledQuerySymbol isSelected={false} queryId={query.id} />
          )}
          <QueryBuilder
            onChange={data => handleChange(data, index)}
            metricsQuery={query}
            projects={selection.projects}
          />
          <ContextMenu
            canRemoveQuery={metricWidgetQueries.length > 1}
            removeQuery={removeQuery}
            queryIndex={index}
            metricsQuery={query}
          />
        </QueryWrapper>
      ))}
      <ButtonBar addQuerySymbolSpacing={showQuerySymbols}>
        <Button size="sm" icon={<IconAdd isCircled />} onClick={addQuery}>
          {t('Add query')}
        </Button>
      </ButtonBar>
    </QueriesWrapper>
  );
}

interface ContextMenuProps {
  canRemoveQuery: boolean;
  metricsQuery: DashboardMetricsQuery;
  queryIndex: number;
  removeQuery: (index: number) => void;
}

function ContextMenu({
  metricsQuery,
  removeQuery,
  canRemoveQuery,
  queryIndex,
}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();

  const createAlert = useMemo(
    () => getCreateAlert(organization, metricsQuery),
    [metricsQuery, organization]
  );

  const items = useMemo<MenuItemProps[]>(() => {
    const customMetric = !isCustomMetric({mri: metricsQuery.mri});
    const addAlertItem = {
      leadingItems: [<IconSiren key="icon" />],
      key: 'add-alert',
      label: t('Create Alert'),
      disabled: !createAlert,
      onAction: () => {
        createAlert?.();
      },
    };
    const removeQueryItem = {
      leadingItems: [<IconClose key="icon" />],
      key: 'delete',
      label: t('Remove Query'),
      disabled: !canRemoveQuery,
      onAction: () => {
        removeQuery(queryIndex);
      },
    };
    const settingsItem = {
      leadingItems: [<IconSettings key="icon" />],
      key: 'settings',
      label: t('Metric Settings'),
      disabled: !customMetric,
      onAction: () => {
        navigateTo(
          `/settings/projects/:projectId/metrics/${encodeURIComponent(metricsQuery.mri)}`,
          router
        );
      },
    };

    return customMetric
      ? [addAlertItem, removeQueryItem, settingsItem]
      : [addAlertItem, removeQueryItem];
  }, [createAlert, metricsQuery.mri, removeQuery, canRemoveQuery, queryIndex, router]);

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        'aria-label': t('Widget actions'),
        size: 'md',
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

const QueriesWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const QueryWrapper = styled('div')<{hasQuerySymbol: boolean}>`
  display: grid;
  gap: ${space(1)};
  padding-bottom: ${space(1)};
  grid-template-columns: 1fr max-content;

  ${p =>
    p.hasQuerySymbol &&
    `
  grid-template-columns: max-content 1fr max-content;
  `}
`;

const StyledQuerySymbol = styled(QuerySymbol)`
  margin-top: 10px;
`;

const ButtonBar = styled('div')<{addQuerySymbolSpacing: boolean}>`
  align-items: center;
  display: flex;
  padding-top: ${space(0.5)};
  gap: ${space(2)};

  ${p =>
    p.addQuerySymbolSpacing &&
    `
    padding-left: ${space(1)};
    margin-left: ${space(2)};
  `}
`;
