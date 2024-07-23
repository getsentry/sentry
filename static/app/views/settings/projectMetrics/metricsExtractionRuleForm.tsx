import {Fragment, useCallback, useId, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form, {type FormProps} from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import type FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconClose, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricAggregation, MetricsExtractionCondition} from 'sentry/types/metrics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DEFAULT_METRICS_CARDINALITY_LIMIT} from 'sentry/utils/metrics/constants';
import useOrganization from 'sentry/utils/useOrganization';
import {SpanIndexedField} from 'sentry/views/insights/spanFields';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';
import {useMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';

export type AggregateGroup = 'count' | 'count_unique' | 'min_max' | 'percentiles';
export interface FormData {
  aggregates: AggregateGroup[];
  conditions: MetricsExtractionCondition[];
  spanAttribute: string | null;
  tags: string[];
}

interface Props extends Omit<FormProps, 'onSubmit'> {
  initialData: FormData;
  projectId: string | number;
  cardinality?: Record<string, number>;
  isEdit?: boolean;
  onSubmit?: (
    data: FormData,
    onSubmitSuccess: (data: FormData) => void,
    onSubmitError: (error: any) => void,
    event: React.FormEvent,
    model: FormModel
  ) => void;
}

const HIGH_CARDINALITY_TAGS = new Set([
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.SPAN_SELF_TIME,
  SpanIndexedField.PROJECT_ID,
  SpanIndexedField.INP,
  SpanIndexedField.INP_SCORE,
  SpanIndexedField.INP_SCORE_WEIGHT,
  SpanIndexedField.TOTAL_SCORE,
  SpanIndexedField.CACHE_ITEM_SIZE,
  SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE,
  SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY,
  SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT,
  SpanIndexedField.TRANSACTION_ID,
  SpanIndexedField.ID,
]);

const AGGREGATE_OPTIONS: {label: string; value: AggregateGroup}[] = [
  {
    label: t('count'),
    value: 'count',
  },
  {
    label: t('count_unique'),
    value: 'count_unique',
  },
  {
    label: t('min, max, sum, avg'),
    value: 'min_max',
  },
  {
    label: t('percentiles'),
    value: 'percentiles',
  },
];

export function explodeAggregateGroup(group: AggregateGroup): MetricAggregation[] {
  switch (group) {
    case 'count':
      return ['count'];
    case 'count_unique':
      return ['count_unique'];
    case 'min_max':
      return ['min', 'max', 'sum', 'avg'];
    case 'percentiles':
      return ['p50', 'p75', 'p95', 'p99'];
    default:
      throw new Error(`Unknown aggregate group: ${group}`);
  }
}

export function aggregatesToGroups(aggregates: MetricAggregation[]): AggregateGroup[] {
  const groups: AggregateGroup[] = [];
  if (aggregates.includes('count')) {
    groups.push('count');
  }

  if (aggregates.includes('count_unique')) {
    groups.push('count_unique');
  }
  const minMaxAggregates = new Set<MetricAggregation>(['min', 'max', 'sum', 'avg']);
  if (aggregates.find(aggregate => minMaxAggregates.has(aggregate))) {
    groups.push('min_max');
  }

  const percentileAggregates = new Set<MetricAggregation>(['p50', 'p75', 'p95', 'p99']);
  if (aggregates.find(aggregate => percentileAggregates.has(aggregate))) {
    groups.push('percentiles');
  }
  return groups;
}

let currentTempId = 0;
function createTempId(): number {
  currentTempId -= 1;
  return currentTempId;
}

export function createCondition(): MetricsExtractionCondition {
  return {
    value: '',
    // id and mris will be set by the backend after creation
    id: createTempId(),
    mris: [],
  };
}

const EMPTY_SET = new Set<never>();
const SPAN_SEARCH_CONFIG = {
  booleanKeys: EMPTY_SET,
  dateKeys: EMPTY_SET,
  durationKeys: EMPTY_SET,
  numericKeys: EMPTY_SET,
  percentageKeys: EMPTY_SET,
  sizeKeys: EMPTY_SET,
  textOperatorKeys: EMPTY_SET,
  disallowFreeText: true,
  disallowWildcard: true,
  disallowNegation: true,
};

export function MetricsExtractionRuleForm({
  isEdit,
  projectId,
  onSubmit,
  cardinality,
  ...props
}: Props) {
  const organization = useOrganization();

  const [customAttributes, setCustomeAttributes] = useState<string[]>(() => {
    const {spanAttribute, tags} = props.initialData;
    return [...new Set(spanAttribute ? [...tags, spanAttribute] : tags)];
  });

  const {data: extractionRules} = useMetricsExtractionRules(organization.slug, projectId);
  const tags = useSpanFieldSupportedTags({projects: [Number(projectId)]});

  // TODO(aknaus): Make this nicer
  const supportedTags = useMemo(() => {
    const copy = {...tags};
    delete copy.has;
    return copy;
  }, [tags]);

  const allAttributeOptions = useMemo(() => {
    let keys = Object.keys(supportedTags);
    if (customAttributes.length) {
      keys = [...new Set(keys.concat(customAttributes))];
    }
    return keys.sort((a, b) => a.localeCompare(b));
  }, [customAttributes, supportedTags]);

  const attributeOptions = useMemo(() => {
    const disabledKeys = new Set(extractionRules?.map(rule => rule.spanAttribute) || []);

    return (
      allAttributeOptions
        .map(key => ({
          label: key,
          value: key,
          disabled: disabledKeys.has(key),
          tooltip: disabledKeys.has(key)
            ? t(
                'This attribute is already in use. Please select another one or edit the existing metric.'
              )
            : undefined,
          tooltipOptions: {position: 'left'},
        }))
        // Sort disabled attributes to bottom
        .sort((a, b) => Number(a.disabled) - Number(b.disabled))
    );
  }, [allAttributeOptions, extractionRules]);

  const tagOptions = useMemo(() => {
    return allAttributeOptions
      .filter(
        // We don't want to suggest numeric fields as tags as they would explode cardinality
        option => !HIGH_CARDINALITY_TAGS.has(option as SpanIndexedField)
      )
      .map(option => ({
        label: option,
        value: option,
      }));
  }, [allAttributeOptions]);

  const handleSubmit = useCallback(
    (
      data: Record<string, any>,
      onSubmitSuccess: (data: Record<string, any>) => void,
      onSubmitError: (error: any) => void,
      event: React.FormEvent,
      model: FormModel
    ) => {
      const errors: Record<string, [string]> = {};

      if (!data.spanAttribute) {
        errors.spanAttribute = [t('Span attribute is required.')];
      }

      if (!data.aggregates.length) {
        errors.aggregates = [t('At least one aggregate is required.')];
      }

      if (Object.keys(errors).length) {
        onSubmitError({responseJSON: errors});
        return;
      }
      onSubmit?.(data as FormData, onSubmitSuccess, onSubmitError, event, model);
    },
    [onSubmit]
  );

  return (
    <Form onSubmit={onSubmit && handleSubmit} {...props}>
      {({model}) => (
        <Fragment>
          <SelectField
            name="spanAttribute"
            options={attributeOptions}
            disabled={isEdit}
            label={t('Measure')}
            help={tct(
              'Define the span attribute you want to track. Learn how to instrument custom attributes in [link:our docs].',
              {
                // TODO(telemetry-experience): add the correct link here once we have it!!!
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/explore/metrics/" />
                ),
              }
            )}
            placeholder={t('Select a span attribute')}
            creatable
            formatCreateLabel={value => `Custom: "${value}"`}
            onCreateOption={value => {
              setCustomeAttributes(curr => [...curr, value]);
              model.setValue('spanAttribute', value);
            }}
            required
          />
          <SelectField
            name="aggregates"
            required
            options={AGGREGATE_OPTIONS}
            label={t('Aggregate')}
            multiple
            help={tct(
              'Select the aggregations you want to store. For more information, read [link:our docs]',
              {
                // TODO(telemetry-experience): add the correct link here once we have it!!!
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/explore/metrics/" />
                ),
              }
            )}
          />
          <SelectField
            name="tags"
            options={tagOptions}
            label={t('Group and filter by')}
            multiple
            placeholder={t('Select tags')}
            help={t(
              'Select the tags that can be used to group and filter the metric. Tag values have to be non-numeric.'
            )}
            creatable
            formatCreateLabel={value => `Custom: "${value}"`}
            onCreateOption={value => {
              setCustomeAttributes(curr => [...curr, value]);
              const currentTags = model.getValue('tags') as string[];
              model.setValue('tags', [...currentTags, value]);
            }}
          />
          <FormField
            label={t('Filters')}
            help={t(
              'Define filters to narrow down the metric to a specific set of spans.'
            )}
            name="conditions"
            inline={false}
            hasControlState={false}
            flexibleControlStateSize
          >
            {({onChange, initialData, value}) => {
              const conditions = (value ||
                initialData ||
                []) as MetricsExtractionCondition[];

              const handleChange = (queryString: string, index: number) => {
                onChange(
                  conditions.toSpliced(index, 1, {
                    ...conditions[index],
                    value: queryString,
                  }),
                  {}
                );
              };

              const getMaxCardinality = (condition: MetricsExtractionCondition) => {
                if (!cardinality) {
                  return 0;
                }
                return condition.mris.reduce(
                  (acc, mri) => Math.max(acc, cardinality[mri] || 0),
                  0
                );
              };

              return (
                <Fragment>
                  <ConditionsWrapper hasDelete={value.length > 1}>
                    {conditions.map((condition, index) => {
                      const maxCardinality = getMaxCardinality(condition);
                      const isExeedingCardinalityLimit =
                        // TODO: Retrieve limit from BE
                        maxCardinality >= DEFAULT_METRICS_CARDINALITY_LIMIT;
                      const hasSiblings = conditions.length > 1;

                      return (
                        <Fragment key={condition.id}>
                          <SearchWrapper
                            hasPrefix={hasSiblings || isExeedingCardinalityLimit}
                          >
                            {hasSiblings || isExeedingCardinalityLimit ? (
                              isExeedingCardinalityLimit ? (
                                <Tooltip
                                  title={t(
                                    'This filter is exeeding the cardinality limit. Remove tags or add more conditions to receive accurate data.'
                                  )}
                                >
                                  <StyledIconWarning size="xs" color="yellow300" />
                                </Tooltip>
                              ) : (
                                <ConditionSymbol>{index + 1}</ConditionSymbol>
                              )
                            ) : null}
                            <SearchBarWithId
                              {...SPAN_SEARCH_CONFIG}
                              searchSource="metrics-extraction"
                              query={condition.value}
                              onSearch={(queryString: string) =>
                                handleChange(queryString, index)
                              }
                              onClose={(queryString: string, {validSearch}) => {
                                if (validSearch) {
                                  handleChange(queryString, index);
                                }
                              }}
                              placeholder={t('Search for span attributes')}
                              organization={organization}
                              supportedTags={supportedTags}
                              dataset={DiscoverDatasets.SPANS_INDEXED}
                              projectIds={[Number(projectId)]}
                              hasRecentSearches={false}
                              savedSearchType={undefined}
                              useFormWrapper={false}
                            />
                          </SearchWrapper>
                          {value.length > 1 && (
                            <Button
                              aria-label={t('Remove Filter')}
                              onClick={() => onChange(conditions.toSpliced(index, 1), {})}
                              icon={<IconClose />}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </ConditionsWrapper>
                  <ConditionsButtonBar>
                    <Button
                      size="sm"
                      onClick={() => onChange([...conditions, createCondition()], {})}
                      icon={<IconAdd />}
                    >
                      {t('Add Filter')}
                    </Button>
                  </ConditionsButtonBar>
                </Fragment>
              );
            }}
          </FormField>
        </Fragment>
      )}
    </Form>
  );
}

function SearchBarWithId(props: React.ComponentProps<typeof SearchBar>) {
  const id = useId();
  return <SearchBar id={id} {...props} />;
}

const ConditionsWrapper = styled('div')<{hasDelete: boolean}>`
  padding: ${space(1)} 0;
  display: grid;
  align-items: center;
  gap: ${space(1)};
  ${p =>
    p.hasDelete
      ? `
  grid-template-columns: 1fr min-content;
  `
      : `
  grid-template-columns: 1fr;
  `}
`;

const SearchWrapper = styled('div')<{hasPrefix?: boolean}>`
  display: grid;
  gap: ${space(1)};
  align-items: center;
  grid-template-columns: ${p => (p.hasPrefix ? 'max-content' : '')} 1fr;
`;

const ConditionSymbol = styled('div')`
  background-color: ${p => p.theme.purple100};
  color: ${p => p.theme.purple400};
  text-align: center;
  align-content: center;
  height: ${space(3)};
  width: ${space(3)};
  border-radius: 50%;
`;

const StyledIconWarning = styled(IconWarning)`
  margin: 0 ${space(0.5)};
`;

const ConditionsButtonBar = styled('div')`
  margin-top: ${space(1)};
`;
