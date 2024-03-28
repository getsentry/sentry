import {useMemo} from 'react';
import styled from '@emotion/styled';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconAdd,
  IconClose,
  IconCopy,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isCustomMetric} from 'sentry/utils/metrics';
import {MetricQueryType} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import type {
  DashboardMetricsEquation,
  DashboardMetricsQuery,
} from 'sentry/views/dashboards/metrics/types';
import {
  filterEquationsByDisplayType,
  filterQueriesByDisplayType,
} from 'sentry/views/dashboards/metrics/utils';
import {DisplayType} from 'sentry/views/dashboards/types';
import {EquationSymbol} from 'sentry/views/metrics/equationSymbol copy';
import {FormulaInput} from 'sentry/views/metrics/formulaInput';
import {getCreateAlert} from 'sentry/views/metrics/metricQueryContextMenu';
import {QueryBuilder} from 'sentry/views/metrics/queryBuilder';
import {getQuerySymbol, QuerySymbol} from 'sentry/views/metrics/querySymbol';

interface Props {
  addEquation: () => void;
  addQuery: (index?: number) => void;
  displayType: DisplayType;
  metricEquations: DashboardMetricsEquation[];
  metricQueries: DashboardMetricsQuery[];
  onEquationChange: (data: Partial<DashboardMetricsEquation>, index: number) => void;
  onQueryChange: (data: Partial<DashboardMetricsQuery>, index: number) => void;
  removeEquation: (index: number) => void;
  removeQuery: (index: number) => void;
}

export function Queries({
  displayType,
  metricQueries,
  metricEquations,
  onQueryChange,
  onEquationChange,
  addQuery,
  addEquation,
  removeQuery,
  removeEquation,
}: Props) {
  const {selection} = usePageFilters();

  const availableVariables = useMemo(
    () => new Set(metricQueries.map(query => getQuerySymbol(query.id))),
    [metricQueries]
  );

  const filteredQueries = useMemo(
    () => filterQueriesByDisplayType(metricQueries, displayType),
    [metricQueries, displayType]
  );

  const filteredEquations = useMemo(
    () => filterEquationsByDisplayType(metricEquations, displayType),
    [metricEquations, displayType]
  );

  const showQuerySymbols = filteredQueries.length + filteredEquations.length > 1;
  const visibleExpressions = [...filteredQueries, ...filteredEquations].filter(
    expression => !expression.isHidden
  );

  return (
    <QueriesWrapper>
      {filteredQueries.map((query, index) => (
        <QueryWrapper key={index} hasQuerySymbol={showQuerySymbols}>
          {showQuerySymbols && (
            <QueryToggle
              isHidden={query.isHidden}
              onChange={isHidden => onQueryChange({isHidden}, index)}
              disabled={!query.isHidden && visibleExpressions.length === 1}
              isSelected={false}
              queryId={query.id}
              type={MetricQueryType.QUERY}
            />
          )}
          <QueryBuilder
            onChange={data => onQueryChange(data, index)}
            metricsQuery={query}
            projects={selection.projects}
          />
          <QueryContextMenu
            canRemoveQuery={filteredQueries.length > 1}
            removeQuery={removeQuery}
            addQuery={addQuery}
            queryIndex={index}
            metricsQuery={query}
          />
        </QueryWrapper>
      ))}
      {filteredEquations.map((equation, index) => (
        <QueryWrapper key={index} hasQuerySymbol={showQuerySymbols}>
          {showQuerySymbols && (
            <QueryToggle
              isHidden={equation.isHidden}
              onChange={isHidden => onEquationChange({isHidden}, index)}
              disabled={!equation.isHidden && visibleExpressions.length === 1}
              isSelected={false}
              queryId={equation.id}
              type={MetricQueryType.FORMULA}
            />
          )}
          <FormulaInput
            onChange={formula => onEquationChange({formula}, index)}
            value={equation.formula}
            availableVariables={availableVariables}
          />
          <EquationContextMenu removeEquation={removeEquation} equationIndex={index} />
        </QueryWrapper>
      ))}
      {displayType !== DisplayType.BIG_NUMBER && (
        <ButtonBar addQuerySymbolSpacing={showQuerySymbols}>
          <Button size="sm" icon={<IconAdd isCircled />} onClick={() => addQuery()}>
            {t('Add query')}
          </Button>
          <Button size="sm" icon={<IconAdd isCircled />} onClick={addEquation}>
            {t('Add equation')}
          </Button>
        </ButtonBar>
      )}
    </QueriesWrapper>
  );
}

interface QueryContextMenuProps {
  addQuery: (index: number) => void;
  canRemoveQuery: boolean;
  metricsQuery: DashboardMetricsQuery;
  queryIndex: number;
  removeQuery: (index: number) => void;
}

function QueryContextMenu({
  metricsQuery,
  removeQuery,
  addQuery,
  canRemoveQuery,
  queryIndex,
}: QueryContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();

  const createAlert = useMemo(
    () => getCreateAlert(organization, metricsQuery),
    [metricsQuery, organization]
  );

  const items = useMemo<MenuItemProps[]>(() => {
    const customMetric = !isCustomMetric({mri: metricsQuery.mri});

    const duplicateQueryItem = {
      leadingItems: [<IconCopy key="icon" />],
      key: 'duplicate',
      label: t('Duplicate'),
      onAction: () => {
        addQuery(queryIndex);
      },
    };
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
      ? [duplicateQueryItem, addAlertItem, removeQueryItem, settingsItem]
      : [duplicateQueryItem, addAlertItem, removeQueryItem];
  }, [
    createAlert,
    metricsQuery.mri,
    removeQuery,
    addQuery,
    canRemoveQuery,
    queryIndex,
    router,
  ]);

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        'aria-label': t('Query actions'),
        size: 'md',
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

interface EquationContextMenuProps {
  equationIndex: number;
  removeEquation: (index: number) => void;
}

function EquationContextMenu({equationIndex, removeEquation}: EquationContextMenuProps) {
  return (
    <Button
      aria-label={t('Remove Equation')}
      onClick={() => removeEquation(equationIndex)}
      size="md"
      icon={<IconClose size="sm" key="icon" />}
    />
  );
}

interface QueryToggleProps {
  disabled: boolean;
  isHidden: boolean;
  isSelected: boolean;
  onChange: (isHidden: boolean) => void;
  queryId: number;
  type: MetricQueryType;
}

function QueryToggle({
  isHidden,
  queryId,
  disabled,
  onChange,
  isSelected,
  type,
}: QueryToggleProps) {
  let tooltipTitle = isHidden ? t('Show query') : t('Hide query');
  if (disabled) {
    tooltipTitle = t('At least one query must be visible');
  }

  return (
    <Tooltip title={tooltipTitle} delay={500}>
      {type === MetricQueryType.QUERY ? (
        <StyledQuerySymbol
          isHidden={isHidden}
          queryId={queryId}
          isClickable={!disabled}
          aria-disabled={disabled}
          isSelected={isSelected}
          onClick={disabled ? undefined : () => onChange(!isHidden)}
          role="button"
          aria-label={isHidden ? t('Show query') : t('Hide query')}
        />
      ) : (
        <StyledEquationSymbol
          isHidden={isHidden}
          equationId={queryId}
          isClickable={!disabled}
          aria-disabled={disabled}
          isSelected={isSelected}
          onClick={disabled ? undefined : () => onChange(!isHidden)}
          role="button"
          aria-label={isHidden ? t('Show query') : t('Hide query')}
        />
      )}
    </Tooltip>
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

const StyledQuerySymbol = styled(QuerySymbol)<{isClickable: boolean}>`
  margin-top: 10px;
  ${p => p.isClickable && `cursor: pointer;`}
`;
const StyledEquationSymbol = styled(EquationSymbol)<{isClickable: boolean}>`
  margin-top: 10px;
  ${p => p.isClickable && `cursor: pointer;`}
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
