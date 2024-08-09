import {Fragment, memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Input, {type InputProps} from 'sentry/components/input';
import {CreateMetricAlertFeature} from 'sentry/components/metrics/createMetricAlertFeature';
import {EquationInput} from 'sentry/components/metrics/equationInput';
import {EquationSymbol} from 'sentry/components/metrics/equationSymbol';
import {QueryBuilder} from 'sentry/components/metrics/queryBuilder';
import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import {getQuerySymbol, QuerySymbol} from 'sentry/components/metrics/querySymbol';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION, SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {
  IconAdd,
  IconClose,
  IconCopy,
  IconDelete,
  IconEdit,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isCustomMetric} from 'sentry/utils/metrics';
import {hasMetricAlertFeature, hasMetricsNewInputs} from 'sentry/utils/metrics/features';
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
  formatAlias,
  getMetricQueryName,
  isVirtualExpression,
} from 'sentry/views/dashboards/metrics/utils';
import {DisplayType} from 'sentry/views/dashboards/types';
import {getCreateAlert} from 'sentry/views/metrics/metricQueryContextMenu';

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

export const Queries = memo(function Queries({
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
  const organization = useOrganization();
  const metricsNewInputs = hasMetricsNewInputs(organization);

  const availableVariables = useMemo(
    () => new Set(metricQueries.map(query => getQuerySymbol(query.id, metricsNewInputs))),
    [metricQueries, metricsNewInputs]
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

  const showQuerySymbols = metricQueries.length + metricEquations.length > 1;
  const visibleExpressions = [...metricQueries, ...metricEquations].filter(
    expression => !expression.isHidden
  );

  return (
    <ExpressionsWrapper>
      {metricQueries.map((query, index) => (
        <ExpressionWrapper key={query.id}>
          {showQuerySymbols && (
            <QueryToggle
              isHidden={query.isHidden}
              onChange={isHidden => onQueryChange({isHidden}, index)}
              disabled={
                (!query.isHidden && visibleExpressions.length === 1) ||
                displayType === DisplayType.BIG_NUMBER
              }
              disabledReason={t('Big Number widgets support only one visible metric')}
              queryId={query.id}
              type={MetricExpressionType.QUERY}
            />
          )}
          <ExpressionFormWrapper>
            <ExpressionFormRowWrapper>
              <WrappedQueryBuilder
                index={index}
                onQueryChange={onQueryChange}
                query={query}
                projects={selection.projects}
              />
              <QueryContextMenu
                canRemoveQuery={metricQueries.length > 1}
                removeQuery={removeQuery}
                addQuery={addQuery}
                editAlias={handleEditQueryAlias}
                queryIndex={index}
                metricsQuery={query}
              />
            </ExpressionFormRowWrapper>
            {query.alias !== undefined && (
              <ExpressionFormRowWrapper>
                <ExpressionAliasForm
                  expression={query}
                  onChange={alias => onQueryChange({alias}, index)}
                  hasContextMenu
                />
              </ExpressionFormRowWrapper>
            )}
          </ExpressionFormWrapper>
        </ExpressionWrapper>
      ))}
      {metricEquations.map((equation, index) => (
        <ExpressionWrapper key={equation.id}>
          {showQuerySymbols && (
            <QueryToggle
              isHidden={equation.isHidden}
              onChange={isHidden => onEquationChange({isHidden}, index)}
              disabled={
                (!equation.isHidden && visibleExpressions.length === 1) ||
                displayType === DisplayType.BIG_NUMBER
              }
              disabledReason={t('Big Number widgets support only one visible metric')}
              queryId={equation.id}
              type={MetricExpressionType.EQUATION}
            />
          )}
          <ExpressionFormWrapper>
            <ExpressionFormRowWrapper>
              <EquationInputWrapper>
                <EquationInput
                  onChange={formula => onEquationChange({formula}, index)}
                  value={equation.formula}
                  availableVariables={availableVariables}
                  metricsNewInputs={metricsNewInputs}
                />
              </EquationInputWrapper>
              {equation.alias !== undefined && (
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
      <ButtonBar addQuerySymbolSpacing={showQuerySymbols}>
        <Button size="sm" icon={<IconAdd isCircled />} onClick={() => addQuery()}>
          {t('Add metric')}
        </Button>
        {!(displayType === DisplayType.BIG_NUMBER && metricEquations.length > 0) && (
          <Button size="sm" icon={<IconAdd isCircled />} onClick={addEquation}>
            {t('Add equation')}
          </Button>
        )}
      </ButtonBar>
    </ExpressionsWrapper>
  );
});

/**
 * Wrapper for the QueryBuilder to memoize the onChange handler
 */
function WrappedQueryBuilder({
  index,
  onQueryChange,
  projects,
  query,
}: {
  index: number;
  onQueryChange: (data: Partial<DashboardMetricsQuery>, index: number) => void;
  projects: number[];
  query: DashboardMetricsQuery;
}) {
  const handleChange = useCallback(
    (data: Partial<DashboardMetricsQuery>) => {
      onQueryChange(data, index);
    },
    [index, onQueryChange]
  );
  return (
    <QueryBuilder
      index={index}
      onChange={handleChange}
      metricsQuery={query}
      projects={projects}
    />
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
      label: <CreateMetricAlertFeature>{t('Create Alert')}</CreateMetricAlertFeature>,
      disabled: !createAlert || !hasMetricAlertFeature(organization),
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
      label: t('Configure Metric'),
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
    metricsQuery.mri,
    createAlert,
    organization,
    canRemoveQuery,
    addQuery,
    queryIndex,
    removeQuery,
    editAlias,
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
      label: t('Remove Equation'),
      onAction: () => {
        removeEquation(equationIndex);
      },
    };
    const aliasItem = {
      leadingItems: [<IconEdit key="icon" />],
      key: 'alias',
      label: t('Add Alias'),
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
  disabledReason?: string;
}

function QueryToggle({
  isHidden,
  queryId,
  disabled,
  onChange,
  type,
  disabledReason,
}: QueryToggleProps) {
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
      title={
        !disabled
          ? tooltipTitle
          : disabledReason || t('At least one query must be visible')
      }
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

function ExpressionAliasForm({
  expression,
  onChange,
  hasContextMenu,
}: {
  expression: DashboardMetricsExpression;
  onChange: (alias: string | undefined) => void;
  hasContextMenu?: boolean;
}) {
  const organization = useOrganization();

  return (
    <ExpressionAliasWrapper hasOwnRow={hasContextMenu}>
      {hasMetricsNewInputs(organization) ? (
        <QueryFieldGroup>
          <QueryFieldGroup.Label>As</QueryFieldGroup.Label>
          <QueryFieldGroup.DebouncedInput
            type="text"
            value={formatAlias(expression.alias)}
            onChange={e => onChange(e.target.value)}
            placeholder={t('Add alias')}
          />
          <QueryFieldGroup.DeleteButton
            disabled={isVirtualExpression(expression)}
            title={t('Clear Alias')}
            onClick={() => onChange(undefined)}
          />
        </QueryFieldGroup>
      ) : (
        <Fragment>
          <StyledLabel>as</StyledLabel>
          <StyledDebouncedInput
            type="text"
            value={formatAlias(expression.alias)}
            onChange={e => onChange(e.target.value)}
            placeholder={t('Add alias')}
          />
          <Tooltip title={t('Clear alias')} delay={SLOW_TOOLTIP_DELAY}>
            <StyledButton
              disabled={isVirtualExpression(expression)}
              icon={<IconDelete size="xs" />}
              aria-label={t('Clear Alias')}
              onClick={() => onChange(undefined)}
            />
          </Tooltip>
        </Fragment>
      )}
    </ExpressionAliasWrapper>
  );
}

// TODO: Move this to a shared component
export function DebouncedInput({
  onChange,
  wait = DEFAULT_DEBOUNCE_DURATION,
  ...inputProps
}: InputProps & {wait?: number}) {
  const [value, setValue] = useState<string | number | readonly string[] | undefined>(
    inputProps.value
  );

  useEffect(() => {
    setValue(inputProps.value);
  }, [inputProps.value]);

  const handleChange = useMemo(
    () =>
      debounce((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(e);
      }, wait),
    [onChange, wait]
  );

  return (
    <Input
      {...inputProps}
      value={value}
      onChange={e => {
        setValue(e.target.value);
        handleChange(e);
      }}
    />
  );
}

const ExpressionsWrapper = styled('div')`
  padding-bottom: ${p => p.theme.space(2)};
`;

const ExpressionWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(1)};
  padding-bottom: ${p => p.theme.space(1)};
`;

const ExpressionFormWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;

  gap: ${p => p.theme.space(1)};
`;

const ExpressionFormRowWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(1)};
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
  gap: ${p => p.theme.space(2)};

  ${p =>
    p.addQuerySymbolSpacing &&
    `
padding-left: ${p.theme.space(1)};
margin-left: 38px;
`}
`;

const ExpressionAliasWrapper = styled('div')<{hasOwnRow?: boolean}>`
  display: flex;
  flex-basis: 50%;
  align-items: center;
  padding-bottom: ${p => p.theme.space(1)};

  /* Add padding for the context menu */
  ${p => p.hasOwnRow && `padding-right: 56px;`}
  ${p => p.hasOwnRow && `flex-grow: 1;`}
`;

const StyledLabel = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space(1)} ${p => p.theme.space(1.5)};

  color: ${p => p.theme.subText};

  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
`;

const EquationInputWrapper = styled('div')`
  width: 100%;
`;

const StyledDebouncedInput = styled(DebouncedInput)`
  border-radius: 0;
  z-index: 1;
`;

const StyledButton = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
`;
