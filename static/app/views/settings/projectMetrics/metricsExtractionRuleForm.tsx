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
import type {MetricType} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

export interface FormData {
  conditions: string[];
  spanAttribute: string | null;
  tags: string[];
  type: MetricType | null;
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

const ListItemDetails = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: right;
  line-height: 1.2;
`;

const TYPE_OPTIONS = [
  {
    label: t('Counter'),
    value: 'c',
    trailingItems: [<ListItemDetails key="aggregates">{t('count')}</ListItemDetails>],
  },
  {
    label: t('Set'),
    value: 's',
    trailingItems: [
      <ListItemDetails key="aggregates">{t('count_unique')}</ListItemDetails>,
    ],
  },
  {
    label: t('Distribution'),
    value: 'd',
    trailingItems: [
      <ListItemDetails key="aggregates">
        {t('count, avg, sum, min, max, percentiles')}
      </ListItemDetails>,
    ],
  },
];

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
            name="type"
            disabled={isEdit}
            options={TYPE_OPTIONS}
            label={t('Type')}
            help={tct(
              'The type of the metric determines which aggregation functions are available and what types of values it can store. For more information, read [link:our docs]',
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
              const conditions = (value || initialData) as string[];
              return (
                <Fragment>
                  <ConditionsWrapper hasDelete={value.length > 1}>
                    {conditions.map((query, index) => (
                      <Fragment key={index}>
                        <SearchWrapper hasPrefix={index !== 0}>
                          {index !== 0 && <ConditionLetter>{t('or')}</ConditionLetter>}
                          <SearchBar
                            {...SPAN_SEARCH_CONFIG}
                            searchSource="metrics-extraction"
                            query={query}
                            onSearch={(queryString: string) =>
                              onChange(conditions.toSpliced(index, 1, queryString), {})
                            }
                            placeholder={t('Search for span attributes')}
                            organization={organization}
                            metricAlert={false}
                            supportedTags={supportedTags}
                            dataset={DiscoverDatasets.SPANS_INDEXED}
                            projectIds={[parseInt(project.id, 10)]}
                            hasRecentSearches={false}
                            onBlur={(queryString: string) =>
                              onChange(conditions.toSpliced(index, 1, queryString), {})
                            }
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
                      onClick={() => onChange([...conditions, ''], {})}
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
