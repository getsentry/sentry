import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import type {SelectValue} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {emptyStringValue} from 'sentry/utils/discover/emptyFieldValues';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import type {
  FieldFormatterRenderFunctionPartial,
  RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  eventsAggregateFunctionOutputType,
  isEquation,
  isLegalYAxisType,
  parseFunction,
  prettifyParsedFunction,
  SPAN_OP_BREAKDOWN_FIELDS,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {Container} from 'sentry/utils/discover/styles';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {FieldKey} from 'sentry/utils/fields';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import type {DashboardFilters, Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {CUSTOM_EQUATION_VALUE} from 'sentry/views/dashboards/widgetBuilder/components/sortBySelectors';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {hasConditionalAggregateFilter} from 'sentry/views/explore/utils/conditionalAggregate';
import {TraceViewSources} from 'sentry/views/performance/traceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/traceUrl';
import {
  createUnnamedTransactionsDiscoverTarget,
  DiscoverQueryPageSource,
  UNPARAMETERIZED_TRANSACTION,
} from 'sentry/views/performance/utils';

export function getTableSortOptions(
  _organization: Organization,
  widgetQuery: WidgetQuery
) {
  const {columns, aggregates} = widgetQuery;
  const options: Array<SelectValue<string>> = [];
  let equations = 0;
  [...aggregates, ...columns]
    .filter(field => !!field)
    .forEach(field => {
      let alias: any;
      let label = stripEquationPrefix(field);
      // Equations are referenced via a standard alias following this pattern
      if (isEquation(field)) {
        alias = `equation[${equations}]`;
        equations += 1;
      }

      const parsedFunction = parseFunction(field);
      if (parsedFunction) {
        label = prettifyParsedFunction(parsedFunction);
      }

      options.push({label, value: alias ?? field});
    });

  return options;
}

export function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (
      option.value.kind === FieldValueKind.FUNCTION ||
      option.value.kind === FieldValueKind.EQUATION ||
      hasConditionalAggregateFilter(option.value.meta.name)
    ) {
      return true;
    }

    return (
      columns.has(option.value.meta.name) ||
      option.value.meta.name === CUSTOM_EQUATION_VALUE
    );
  };
}

export function getTimeseriesSortOptions(
  organization: Organization,
  widgetQuery: WidgetQuery,
  tags?: TagCollection,
  getFieldOptions: typeof getEventsTableFieldOptions = getEventsTableFieldOptions
) {
  const options: Record<string, SelectValue<FieldValue>> = {};
  options[`field:${CUSTOM_EQUATION_VALUE}`] = {
    label: 'Custom Equation',
    value: {
      kind: FieldValueKind.EQUATION,
      meta: {name: CUSTOM_EQUATION_VALUE},
    },
  };

  let equations = 0;
  [...widgetQuery.aggregates, ...widgetQuery.columns]
    .filter(field => !!field)
    .forEach(field => {
      let alias: any;
      const label = stripEquationPrefix(field);
      // Equations are referenced via a standard alias following this pattern
      if (isEquation(field)) {
        alias = `equation[${equations}]`;
        equations += 1;
        options[`equation:${alias}`] = {
          label,
          value: {
            kind: FieldValueKind.EQUATION,
            meta: {
              name: alias ?? field,
            },
          },
        };
        return;
      }

      // Explore `_if` series are not in the generic aggregate catalog (avg, p95, …).
      // Add each combinator that already exists on the widget as its own sort option.
      if (hasConditionalAggregateFilter(field)) {
        const parsedFunction = parseFunction(field);
        if (!parsedFunction) {
          return;
        }
        options[`field:${field}`] = {
          label: prettifyParsedFunction(parsedFunction),
          value: {
            kind: FieldValueKind.FIELD,
            meta: {
              dataType: 'number',
              name: field,
            },
          },
        };
      }
    });

  const fieldOptions = getFieldOptions(organization, tags);

  // Widget-specific options (equations, `_if` combinators) must win over the
  // generic field catalog so they are not overwritten by a colliding key.
  return {...fieldOptions, ...options};
}

function getEventsTableFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
) {
  const measurements = getMeasurements();

  return generateFieldOptions({
    organization,
    tagKeys: Object.values(tags ?? {}).map(({key}) => key),
    measurementKeys: Object.values(measurements).map(({key}) => key),
    spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
    customMeasurements: Object.values(customMeasurements ?? {}).map(
      ({key, functions}) => ({
        key,
        functions,
      })
    ),
  });
}

export function transformEventsResponseToTable(
  data: TableData | EventsTableData,
  _widgetQuery: WidgetQuery
): TableData {
  let tableData = data;
  // events api uses a different response format so we need to construct tableData differently
  const {fields, ...otherMeta} = (data as EventsTableData).meta ?? {};
  tableData = {
    ...data,
    meta: {...fields, ...otherMeta, fields},
  };
  return tableData;
}

export function filterYAxisAggregateParams(
  fieldValue: QueryFieldValue,
  displayType: DisplayType
) {
  return (option: FieldValueOption) => {
    // Only validate function parameters for timeseries widgets and
    // world map widgets.
    if (displayType === DisplayType.BIG_NUMBER) {
      return true;
    }

    if (fieldValue.kind !== FieldValueKind.FUNCTION) {
      return true;
    }

    const functionName = fieldValue.function[0];
    const primaryOutput = eventsAggregateFunctionOutputType(
      functionName,
      option.value.meta.name
    );
    if (primaryOutput) {
      return isLegalYAxisType(primaryOutput);
    }

    if (
      option.value.kind === FieldValueKind.FUNCTION ||
      option.value.kind === FieldValueKind.EQUATION
    ) {
      // Functions and equations are not legal options as an aggregate/function parameter.
      return false;
    }

    return isLegalYAxisType(option.value.meta.dataType);
  };
}

export function filterYAxisOptions(displayType: DisplayType) {
  return (option: FieldValueOption) => {
    // Only validate function names for timeseries widgets and
    // world map widgets.
    if (
      !(displayType === DisplayType.BIG_NUMBER) &&
      option.value.kind === FieldValueKind.FUNCTION
    ) {
      const primaryOutput = eventsAggregateFunctionOutputType(
        option.value.meta.name,
        undefined
      );
      if (primaryOutput) {
        // If a function returns a specific type, then validate it.
        return isLegalYAxisType(primaryOutput);
      }
    }

    return option.value.kind === FieldValueKind.FUNCTION;
  };
}

export function renderEventIdAsLinkable(
  data: EventData,
  {eventView, organization}: RenderFunctionBaggage
) {
  const id: string | unknown = data?.id;
  if (!eventView || typeof id !== 'string') {
    return <Container>{emptyStringValue}</Container>;
  }

  const eventSlug = generateEventSlug(data);

  const target = eventDetailsRouteWithEventView({
    organization,
    eventSlug,
    eventView,
  });

  return (
    <Link data-test-id="view-event" to={target}>
      <StyledTooltip title={t('View Event')}>
        <Container>{getShortEventId(id)}</Container>
      </StyledTooltip>
    </Link>
  );
}

export function renderTraceAsLinkable(widget?: Widget) {
  return function (
    data: EventData,
    {eventView, organization, location}: RenderFunctionBaggage
  ) {
    const id: string | unknown = data?.trace;
    if (!eventView || typeof id !== 'string') {
      return <Container>{emptyStringValue}</Container>;
    }
    const dateSelection = eventView.normalizeDateSelection(location);
    const target = getTraceDetailsUrl({
      organization,
      traceSlug: String(data.trace),
      dateSelection,
      timestamp: getTimeStampFromTableDateField(data['max(timestamp)'] ?? data.timestamp),
      location: widget
        ? {
            ...location,
            query: {
              ...location.query,
              widgetId: widget.id,
              dashboardId: widget.dashboardId,
            },
          }
        : location,
      source: TraceViewSources.DASHBOARDS,
    });

    return (
      <Link data-test-id="view-trace" to={target}>
        <StyledTooltip title={t('View Trace')}>
          <Container>{getShortEventId(id)}</Container>
        </StyledTooltip>
      </Link>
    );
  };
}

export function getCustomEventsFieldRenderer(
  field: string,
  meta: MetaType,
  widget?: Widget,
  _organization?: Organization,
  dashboardFilters?: DashboardFilters
): FieldFormatterRenderFunctionPartial {
  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable(widget);
  }

  // When title or transaction are << unparameterized >>, link out to discover showing unparameterized transactions
  if (['title', 'transaction'].includes(field)) {
    return function (data, baggage) {
      if (data[field] === UNPARAMETERIZED_TRANSACTION) {
        return (
          <Container>
            <Link
              to={createUnnamedTransactionsDiscoverTarget({
                location: baggage.location,
                organization: baggage.organization,
                source: DiscoverQueryPageSource.DISCOVER,
              })}
            >
              {data[field]}
            </Link>
          </Container>
        );
      }
      return getFieldRenderer(
        field,
        meta,
        false,
        widget,
        dashboardFilters
      )(data, baggage);
    };
  }
  return getFieldRenderer(field, meta, false, widget, dashboardFilters);
}

// Checks fieldValue to see what function is being used and only allow supported custom measurements
export function filterAggregateParams(
  option: FieldValueOption,
  fieldValue?: QueryFieldValue
) {
  if (
    (option.value.kind === FieldValueKind.CUSTOM_MEASUREMENT &&
      fieldValue?.kind === 'function' &&
      fieldValue?.function &&
      !option.value.meta.functions.includes(fieldValue.function[0])) ||
    option.value.meta.name === FieldKey.TOTAL_COUNT
  ) {
    return false;
  }
  return true;
}

const StyledTooltip = styled(Tooltip)`
  vertical-align: middle;
`;
