import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Flex} from '@sentry/scraps/layout';

import {Select} from 'sentry/components/core/select';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  getFieldDefinition,
  NO_ARGUMENT_SPAN_AGGREGATES,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {Dataset, type EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {getTraceItemTypeForDatasetAndEventType} from 'sentry/views/alerts/wizard/utils';
import {BufferedInput} from 'sentry/views/discover/table/queryField';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {
  DEFAULT_VISUALIZATION_FIELD,
  updateVisualizeAggregate,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  OurLogKnownFieldKey,
  type OurLogsAggregate,
} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

const DEFAULT_EAP_AGGREGATION = 'count';
const DEFAULT_EAP_FIELD = 'span.duration';

interface Props {
  aggregate: string;
  eventTypes: EventTypes[];
  onChange: (value: string, meta: Record<string, any>) => void;
}

const SUPPORTED_MULTI_PARAM_AGGREGATES = [
  {label: AggregationKey.APDEX, value: AggregationKey.APDEX},
];

const SPAN_OPERATIONS = [
  ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => ({
    label: aggregate,
    value: aggregate,
  })),
  ...SUPPORTED_MULTI_PARAM_AGGREGATES,
];

const LOG_OPERATIONS = [
  AggregationKey.COUNT,
  AggregationKey.COUNT_UNIQUE,
  AggregationKey.SUM,
  AggregationKey.AVG,
  AggregationKey.P50,
  AggregationKey.P75,
  AggregationKey.P90,
  AggregationKey.P95,
  AggregationKey.P99,
  AggregationKey.MIN,
  AggregationKey.MAX,
].map(aggregate => ({
  label: aggregate,
  value: aggregate as OurLogsAggregate,
})) satisfies Array<{label: string; value: OurLogsAggregate}>;

function EAPFieldWrapper({aggregate, onChange, eventTypes}: Props) {
  return <EAPField aggregate={aggregate} onChange={onChange} eventTypes={eventTypes} />;
}

function EAPField({aggregate, onChange, eventTypes}: Props) {
  const traceItemType =
    getTraceItemTypeForDatasetAndEventType(
      Dataset.EVENTS_ANALYTICS_PLATFORM,
      eventTypes
    ) || TraceItemDataset.SPANS;

  const {name: aggregation, arguments: aggregateFuncArgs} = parseFunction(aggregate) ?? {
    arguments: undefined,
  };

  const {attributes: storedNumberTags} = useTraceItemAttributes('number');
  const {attributes: storedStringTags} = useTraceItemAttributes('string');

  const storedTags = useMemo(() => {
    return aggregation === AggregationKey.COUNT_UNIQUE
      ? {...storedNumberTags, ...storedStringTags}
      : storedNumberTags;
  }, [aggregation, storedNumberTags, storedStringTags]);

  const fieldsArray = useMemo(() => {
    return Object.values(storedTags).toSorted((a, b) => {
      const aLabel = prettifyTagKey(a.key);
      const bLabel = prettifyTagKey(b.key);
      return aLabel.localeCompare(bLabel);
    });
  }, [storedTags]);

  // When using the async variant of SelectControl, we need to pass in an option object instead of just the value
  const lockOptions = useMemo(() => {
    if (aggregation === AggregationKey.COUNT && traceItemType === TraceItemDataset.LOGS) {
      return true;
    }

    if (aggregation === AggregationKey.COUNT) {
      return true;
    }

    if (
      aggregation &&
      NO_ARGUMENT_SPAN_AGGREGATES.includes(aggregation as AggregationKey)
    ) {
      return true;
    }

    return false;
  }, [aggregation, traceItemType]);

  const getSelectedOption = useCallback(
    (option: string | undefined) => {
      if (
        aggregation === AggregationKey.COUNT &&
        traceItemType === TraceItemDataset.LOGS
      ) {
        return {label: t('logs'), value: 'message'};
      }

      if (aggregation === AggregationKey.COUNT) {
        return {label: t('spans'), value: DEFAULT_VISUALIZATION_FIELD};
      }

      if (
        aggregation &&
        NO_ARGUMENT_SPAN_AGGREGATES.includes(aggregation as AggregationKey)
      ) {
        return {label: t('spans'), value: ''};
      }

      const fieldName = fieldsArray.find(f => f.key === option)?.name;
      return {label: fieldName, value: option};
    },
    [aggregation, fieldsArray, traceItemType]
  );

  const handleArgumentChange = useCallback(
    (index: number, value: string) => {
      let args = cloneDeep(aggregateFuncArgs);
      if (args) {
        args[index] = value;
      } else {
        args = [value];
      }
      const newYAxis = `${aggregation}(${args.join(',')})`;
      onChange(newYAxis, {});
    },
    [aggregateFuncArgs, aggregation, onChange]
  );

  const handleOperationChange = useCallback(
    (option: any) => {
      let newAggregate: string;
      if (traceItemType === TraceItemDataset.LOGS) {
        if ([AggregationKey.COUNT, AggregationKey.COUNT_UNIQUE].includes(option.value)) {
          newAggregate = `${option.value}(${OurLogKnownFieldKey.MESSAGE})`;
        } else if (NO_ARGUMENT_SPAN_AGGREGATES.includes(option.value as AggregationKey)) {
          newAggregate = `${option.value}()`;
        } else {
          const argument =
            aggregateFuncArgs?.[0] && defined(storedNumberTags[aggregateFuncArgs?.[0]])
              ? aggregateFuncArgs?.[0]
              : (Object.values(storedNumberTags)?.[0]?.key ?? '');
          newAggregate = `${option.value}(${argument})`;
        }
      } else {
        newAggregate = updateVisualizeAggregate({
          newAggregate: option.value,
          oldAggregate: aggregation || DEFAULT_EAP_AGGREGATION,
          oldArguments: aggregateFuncArgs ? aggregateFuncArgs : [DEFAULT_EAP_FIELD],
        });
      }
      onChange(newAggregate, {});
    },
    [aggregateFuncArgs, aggregation, onChange, storedNumberTags, traceItemType]
  );

  // As SelectControl does not support an options size limit out of the box
  // we work around it by using the async variant of the control
  const getFieldOptions = useCallback(
    (searchText: string) => {
      const filteredMeta = fieldsArray.filter(
        ({name}) =>
          searchText === '' || name.toLowerCase().includes(searchText.toLowerCase())
      );

      return filteredMeta.map(metric => {
        return {
          label: metric.name,
          value: metric.key,
          textValue: metric.key,
          trailingItems: <TypeBadge kind={metric.kind} />,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={metric.key}
              kind={metric.kind}
              label={metric.name}
              traceItemType={traceItemType}
            />
          ),
        };
      });
    },
    [fieldsArray, traceItemType]
  );

  const operations =
    traceItemType === TraceItemDataset.LOGS ? LOG_OPERATIONS : SPAN_OPERATIONS;

  const aggregateDefinition = aggregation
    ? getFieldDefinition(
        aggregation,
        traceItemType === TraceItemDataset.LOGS ? 'log' : 'span'
      )
    : undefined;

  return (
    <Flex gap="md">
      <StyledSelectControl
        searchable
        placeholder={t('Select an operation')}
        options={operations}
        value={aggregation}
        onChange={handleOperationChange}
      />
      {aggregateDefinition?.parameters?.map((param, index) => {
        if (param.kind === 'value') {
          return (
            <FlexWrapper key={param.name}>
              <BufferedInput
                type="integer"
                name={param.name}
                value={aggregateFuncArgs?.[index] || param.defaultValue || ''}
                placeholder={param.placeholder}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    handleArgumentChange(index, e.currentTarget.value);
                  }
                }}
                onChange={event => handleArgumentChange(index, event.target.value)}
                onBlur={event => handleArgumentChange(index, event.target.value)}
                onUpdate={value => handleArgumentChange(index, value)}
              />
            </FlexWrapper>
          );
        }
        return (
          <FlexWrapper key={param.name}>
            <StyledSelectControl
              key={param.name}
              searchable
              placeholder={t('Select a metric')}
              noOptionsMessage={() =>
                fieldsArray.length === 0
                  ? t('No metrics in this project')
                  : t('No options')
              }
              async
              defaultOptions={getFieldOptions('')}
              loadOptions={(searchText: any) =>
                Promise.resolve(getFieldOptions(searchText))
              }
              value={getSelectedOption(aggregateFuncArgs?.[index])}
              onChange={(option: {value: string}) =>
                handleArgumentChange(index, option.value)
              }
              disabled={lockOptions}
            />
          </FlexWrapper>
        );
      })}
      {(aggregateDefinition?.parameters?.length === 0 ||
        !defined(aggregateDefinition?.parameters)) && ( // for parameterless functions, we want to still show show greyed out spans
        <FlexWrapper>
          <StyledSelectControl
            searchable
            placeholder={t('Select a metric')}
            noOptionsMessage={() =>
              fieldsArray.length === 0 ? t('No metrics in this project') : t('No options')
            }
            async
            defaultOptions={getFieldOptions('')}
            loadOptions={(searchText: any) =>
              Promise.resolve(getFieldOptions(searchText))
            }
            value={getSelectedOption(undefined)}
            onChange={(option: {value: string}) => handleArgumentChange(0, option.value)}
            disabled={lockOptions}
          />
        </FlexWrapper>
      )}
    </Flex>
  );
}

export default EAPFieldWrapper;

const FlexWrapper = styled('div')`
  flex: 1;
`;

const StyledSelectControl = styled(Select)`
  width: 200px;
`;
