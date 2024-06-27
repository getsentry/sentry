import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form, {type FormProps} from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import type FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconAdd, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsAggregate, MetricsExtractionCondition} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

export type AggregateGroup = 'count' | 'count_unique' | 'min_max' | 'percentiles';
export interface FormData {
  aggregates: AggregateGroup[];
  conditions: MetricsExtractionCondition[];
  spanAttribute: string | null;
  tags: string[];
}

interface Props extends Omit<FormProps, 'onSubmit'> {
  initialData: FormData;
  project: Project;
  isEdit?: boolean;
  onSubmit?: (
    data: FormData,
    onSubmitSuccess: (data: FormData) => void,
    onSubmitError: (error: any) => void,
    event: React.FormEvent,
    model: FormModel
  ) => void;
}

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

export function explodeAggregateGroup(group: AggregateGroup): MetricsAggregate[] {
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

export function aggregatesToGroups(aggregates: MetricsAggregate[]): AggregateGroup[] {
  const groups: AggregateGroup[] = [];
  if (aggregates.includes('count')) {
    groups.push('count');
  }

  if (aggregates.includes('count_unique')) {
    groups.push('count_unique');
  }
  const minMaxAggregates = new Set<MetricsAggregate>(['min', 'max', 'sum', 'avg']);
  if (aggregates.find(aggregate => minMaxAggregates.has(aggregate))) {
    groups.push('min_max');
  }

  const percentileAggregates = new Set<MetricsAggregate>(['p50', 'p75', 'p95', 'p99']);
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
    query: '',
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

export function MetricsExtractionRuleForm({isEdit, project, onSubmit, ...props}: Props) {
  const [customAttributes, setCustomeAttributes] = useState<string[]>(() => {
    const {spanAttribute, tags} = props.initialData;
    return [...new Set(spanAttribute ? [...tags, spanAttribute] : tags)];
  });
  const organization = useOrganization();
  const tags = useSpanFieldSupportedTags({projects: [parseInt(project.id, 10)]});

  // TODO(aknaus): Make this nicer
  const supportedTags = useMemo(() => {
    const copy = {...tags};
    delete copy.has;
    return copy;
  }, [tags]);

  const attributeOptions = useMemo(() => {
    let keys = Object.keys(supportedTags);

    if (customAttributes.length) {
      keys = [...new Set(keys.concat(customAttributes))];
    }

    return keys
      .map(key => ({
        label: key,
        value: key,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [customAttributes, supportedTags]);

  const handleSubmit = useCallback(
    (
      data: Record<string, any>,
      onSubmitSuccess: (data: Record<string, any>) => void,
      onSubmitError: (error: any) => void,
      event: React.FormEvent,
      model: FormModel
    ) => {
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
            options={attributeOptions}
            label={t('Group and filter by')}
            multiple
            placeholder={t('Select tags')}
            help={t('Select the tags that can be used to group and filter the metric.')}
            creatable
            formatCreateLabel={value => `Custom: "${value}"`}
            onCreateOption={value => {
              setCustomeAttributes(curr => [...curr, value]);
              const currentTags = model.getValue('tags') as string[];
              model.setValue('tags', [...currentTags, value]);
            }}
          />
          <FormField
            label={t('Queries')}
            help={t(
              'Define queries to narrow down the metric extraction to a specific set of spans.'
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
                    query: queryString,
                  }),
                  {}
                );
              };

              return (
                <Fragment>
                  <ConditionsWrapper hasDelete={value.length > 1}>
                    {conditions.map((condition, index) => (
                      <Fragment key={condition.id}>
                        <SearchWrapper hasPrefix={index !== 0}>
                          {index !== 0 && <ConditionLetter>{t('or')}</ConditionLetter>}
                          <SearchBar
                            {...SPAN_SEARCH_CONFIG}
                            searchSource="metrics-extraction"
                            query={condition.query}
                            onSearch={(queryString: string) =>
                              handleChange(queryString, index)
                            }
                            placeholder={t('Search for span attributes')}
                            organization={organization}
                            metricAlert={false}
                            supportedTags={supportedTags}
                            dataset={DiscoverDatasets.SPANS_INDEXED}
                            projectIds={[parseInt(project.id, 10)]}
                            hasRecentSearches={false}
                            onBlur={(queryString: string) =>
                              handleChange(queryString, index)
                            }
                            savedSearchType={undefined}
                            useFormWrapper={false}
                          />
                        </SearchWrapper>
                        {value.length > 1 && (
                          <Button
                            aria-label={t('Remove Query')}
                            onClick={() => onChange(conditions.toSpliced(index, 1), {})}
                            icon={<IconClose />}
                          />
                        )}
                      </Fragment>
                    ))}
                  </ConditionsWrapper>
                  <ConditionsButtonBar>
                    <Button
                      onClick={() => onChange([...conditions, createCondition()], {})}
                      icon={<IconAdd />}
                    >
                      {t('Add Query')}
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

const ConditionsWrapper = styled('div')<{hasDelete: boolean}>`
  display: grid;
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

const SearchWrapper = styled('div')<{hasPrefix: boolean}>`
  display: grid;
  gap: ${space(1)};
  ${p =>
    p.hasPrefix
      ? `
  grid-template-columns: max-content 1fr;
  `
      : `
  grid-template-columns: 1fr;
  `}
`;

const ConditionLetter = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  padding: 0 ${space(2)};
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
  align-content: center;
`;

const ConditionsButtonBar = styled('div')`
  margin-top: ${space(1)};
`;
