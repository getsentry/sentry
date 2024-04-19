import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Input from 'sentry/components/input';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconAdd,
  IconClose,
  IconCopy,
  IconEdit,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isCustomMetric} from 'sentry/utils/metrics';
import {MetricExpressionType} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import type {
  DashboardMetricsEquation,
  DashboardMetricsExpression,
  DashboardMetricsQuery,
} from 'sentry/views/dashboards/metrics/types';
import {
  filterEquationsByDisplayType,
  filterQueriesByDisplayType,
  getMetricQueryName,
} from 'sentry/views/dashboards/metrics/utils';
import {DisplayType} from 'sentry/views/dashboards/types';
import {EquationSymbol} from 'sentry/views/metrics/equationSymbol';
import {FormulaInput as EquationInput} from 'sentry/views/metrics/formulaInput';
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

  const handleEditQueryAlias = useCallback(
    (index: number) => {
      const query = metricQueries[index];
      const alias = getMetricQueryName(query);

      onQueryChange({alias}, index);
    },
    [metricQueries, onQueryChange]
  );

  const handleEditEquationAlias = useCallback(
    (index: number) => {
      const equation = metricEquations[index];
      const alias = getMetricQueryName(equation);

      onEquationChange({alias: alias ?? ''}, index);
    },
    [metricEquations, onEquationChange]
  );

  const showQuerySymbols = filteredQueries.length + filteredEquations.length > 1;
  const visibleExpressions = [...filteredQueries, ...filteredEquations].filter(
    expression => !expression.isHidden
  );

  return (
    <ExpressionsWrapper>
      {filteredQueries.map((query, index) => (
        <ExpressionWrapper key={index} hasQuerySymbol={showQuerySymbols}>
          {showQuerySymbols && (
            <QueryToggle
              isHidden={query.isHidden}
              onChange={isHidden => onQueryChange({isHidden}, index)}
              disabled={!query.isHidden && visibleExpressions.length === 1}
              queryId={query.id}
              type={MetricExpressionType.QUERY}
            />
          )}
          <ExpressionFormWrapper>
            <ExpressionFormRowWrapper>
              <QueryBuilder
                onChange={data => onQueryChange(data, index)}
                metricsQuery={query}
                projects={selection.projects}
              />
              <QueryContextMenu
                canRemoveQuery={filteredQueries.length > 1}
                removeQuery={removeQuery}
                addQuery={addQuery}
                editAlias={handleEditQueryAlias}
                queryIndex={index}
                metricsQuery={query}
              />
            </ExpressionFormRowWrapper>
            {query.alias && (
              <ExpressionFormRowWrapper>
                <ExpressionAliasForm
                  expression={query}
                  onChange={alias => onQueryChange({alias}, index)}
                />
              </ExpressionFormRowWrapper>
            )}
          </ExpressionFormWrapper>
        </ExpressionWrapper>
      ))}
      {filteredEquations.map((equation, index) => (
        <ExpressionWrapper key={index} hasQuerySymbol={showQuerySymbols}>
          {showQuerySymbols && (
            <QueryToggle
              isHidden={equation.isHidden}
              onChange={isHidden => onEquationChange({isHidden}, index)}
              disabled={!equation.isHidden && visibleExpressions.length === 1}
              queryId={equation.id}
              type={MetricExpressionType.EQUATION}
            />
          )}
          <ExpressionFormWrapper>
            <ExpressionFormRowWrapper>
              <EquationInput
                onChange={formula => onEquationChange({formula}, index)}
                value={equation.formula}
                availableVariables={availableVariables}
              />
              {equation.alias && (
                <ExpressionAliasForm
                  expression={equation}
                  onChange={alias => onEquationChange({alias}, index)}
                />
              )}
              <EquationContextMenu
                removeEquation={removeEquation}
                editAlias={handleEditEquationAlias}
                equationIndex={index}
              />
            </ExpressionFormRowWrapper>
          </ExpressionFormWrapper>
        </ExpressionWrapper>
      ))}
      {displayType !== DisplayType.BIG_NUMBER && (
        <ButtonBar addQuerySymbolSpacing={showQuerySymbols}>
          <Button size="sm" icon={<IconAdd isCircled />} onClick={() => addQuery()}>
            {t('Add metric')}
          </Button>
          <Button size="sm" icon={<IconAdd isCircled />} onClick={addEquation}>
            {t('Add equation')}
          </Button>
        </ButtonBar>
      )}
    </ExpressionsWrapper>
  );
}

interface QueryContextMenuProps {
  addQuery: (index: number) => void;
  canRemoveQuery: boolean;
  editAlias: (index: number) => void;
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
  editAlias,
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
      label: t('Remove Metric'),
      disabled: !canRemoveQuery,
      onAction: () => {
        removeQuery(queryIndex);
      },
    };
    const aliasItem = {
      leadingItems: [<IconEdit key="icon" />],
      key: 'alias',
      label: t('Add Alias'),
      onAction: () => {
        editAlias(queryIndex);
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
      ? [duplicateQueryItem, aliasItem, addAlertItem, removeQueryItem, settingsItem]
      : [duplicateQueryItem, aliasItem, addAlertItem, removeQueryItem];
  }, [
    createAlert,
    metricsQuery.mri,
    removeQuery,
    addQuery,
    editAlias,
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
  editAlias: (index: number) => void;
  equationIndex: number;
  removeEquation: (index: number) => void;
}

function EquationContextMenu({
  equationIndex,
  editAlias,
  removeEquation,
}: EquationContextMenuProps) {
  const items = useMemo<MenuItemProps[]>(() => {
    const removeEquationItem = {
      leadingItems: [<IconClose key="icon" />],
      key: 'delete',
      label: t('Remove Query'),
      onAction: () => {
        removeEquation(equationIndex);
      },
    };
    const aliasItem = {
      leadingItems: [<IconEdit key="icon" />],
      key: 'alias',
      label: t('Alias'),
      onAction: () => {
        editAlias(equationIndex);
      },
    };

    return [aliasItem, removeEquationItem];
  }, [editAlias, equationIndex, removeEquation]);

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        'aria-label': t('Equation actions'),
        size: 'md',
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

interface QueryToggleProps {
  disabled: boolean;
  isHidden: boolean;
  onChange: (isHidden: boolean) => void;
  queryId: number;
  type: MetricExpressionType;
}

function QueryToggle({isHidden, queryId, disabled, onChange, type}: QueryToggleProps) {
  const tooltipTitle =
    type === MetricExpressionType.QUERY
      ? isHidden
        ? t('Show metric')
        : t('Hide metric')
      : isHidden
        ? t('Show equation')
        : t('Hide equation');

  return (
    <Tooltip
      title={!disabled ? tooltipTitle : t('At least one query must be visible')}
      delay={500}
    >
      {type === MetricExpressionType.QUERY ? (
        <StyledQuerySymbol
          isHidden={isHidden}
          queryId={queryId}
          isClickable={!disabled}
          aria-disabled={disabled}
          onClick={disabled ? undefined : () => onChange(!isHidden)}
          role="button"
          aria-label={tooltipTitle}
        />
      ) : (
        <StyledEquationSymbol
          isHidden={isHidden}
          equationId={queryId}
          isClickable={!disabled}
          aria-disabled={disabled}
          onClick={disabled ? undefined : () => onChange(!isHidden)}
          role="button"
          aria-label={tooltipTitle}
        />
      )}
    </Tooltip>
  );
}

const ExpressionsWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const ExpressionWrapper = styled('div')<{hasQuerySymbol: boolean}>`
  display: flex;
  gap: ${space(1)};
  padding-bottom: ${space(1)};
`;

const ExpressionFormWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;

  gap: ${space(1)};
`;

const ExpressionFormRowWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledQuerySymbol = styled(QuerySymbol)<{isClickable: boolean}>`
  ${p => p.isClickable && `cursor: pointer;`}
`;
const StyledEquationSymbol = styled(EquationSymbol)<{isClickable: boolean}>`
  ${p => p.isClickable && `cursor: pointer;`}
`;

const ButtonBar = styled('div')<{addQuerySymbolSpacing: boolean}>`
  align-items: center;
  display: flex;
  gap: ${space(2)};

  ${p =>
    p.addQuerySymbolSpacing &&
    `
    padding-left: ${space(1)};
    margin-left: 38px;
  `}
`;

function ExpressionAliasForm({
  expression,
  onChange,
}: {
  expression: DashboardMetricsExpression;
  onChange: (alias: string | undefined) => void;
}) {
  return (
    <QueryAliasWrapper>
      <div>as</div>
      <Input
        type="text"
        value={expression.alias}
        onChange={e => onChange(e.target.value)}
        placeholder={t('Add alias')}
      />
      <Button
        icon={<IconClose />}
        aria-label="Clear Alias"
        onClick={() => onChange(undefined)}
      />
    </QueryAliasWrapper>
  );
}

const QueryAliasWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  align-items: center;
  gap: ${space(1)};
  padding-bottom: ${space(1)};
`;
