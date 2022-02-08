import * as React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import Button from 'sentry/components/button';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {explodeField, generateFieldAsString} from 'sentry/utils/discover/fields';
import {Widget, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  METRICS_AGGREGATIONS,
  METRICS_FIELDS,
  MetricsColumnType,
} from 'sentry/views/dashboardsV2/widget/metricWidget/fields';
import {FieldValue, FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import MetricsSearchBar from 'sentry/views/performance/metricsSearchBar';
import Input from 'sentry/views/settings/components/forms/controls/input';
import Field from 'sentry/views/settings/components/forms/field';

import WidgetQueryFields from './widgetQueryFields';

export function generateMetricsWidgetFieldOptions(
  fields: Record<string, MetricsColumnType> = METRICS_FIELDS,
  tagKeys?: string[]
) {
  const aggregations = METRICS_AGGREGATIONS;
  const fieldKeys = Object.keys(fields).sort();
  const functions = Object.keys(aggregations);
  const fieldOptions: Record<string, SelectValue<FieldValue>> = {};

  // Index items by prefixed keys as custom tags can overlap both fields and
  // function names. Having a mapping makes finding the value objects easier
  // later as well.
  functions.forEach(func => {
    const ellipsis = aggregations[func].parameters.length ? '\u2026' : '';
    const parameters = aggregations[func].parameters;

    fieldOptions[`function:${func}`] = {
      label: `${func}(${ellipsis})`,
      value: {
        kind: FieldValueKind.FUNCTION,
        meta: {
          name: func,
          parameters,
        },
      },
    };
  });

  fieldKeys.forEach(field => {
    fieldOptions[`field:${field}`] = {
      label: field,
      value: {
        kind: FieldValueKind.METRICS,
        meta: {
          name: field,
          dataType: fields[field],
        },
      },
    };
  });

  if (defined(tagKeys)) {
    tagKeys.sort();
    tagKeys.forEach(tag => {
      fieldOptions[`tag:${tag}`] = {
        label: tag,
        value: {
          kind: FieldValueKind.TAG,
          meta: {name: tag, dataType: 'string'},
        },
      };
    });
  }

  return fieldOptions;
}

type Props = {
  canAddSearchConditions: boolean;
  displayType: Widget['displayType'];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  handleAddSearchConditions: () => void;
  handleDeleteQuery: (queryIndex: number) => void;
  onChange: (queryIndex: number, widgetQuery: WidgetQuery) => void;
  organization: Organization;
  queries: WidgetQuery[];
  selection: PageFilters;
  errors?: Array<Record<string, any>>;
};

class MetricsWidgetQueriesForm extends React.Component<Props> {
  blurTimeout: number | null = null;

  // Handle scalar field values changing.
  handleFieldChange = (queryIndex: number, field: string) => {
    const {queries, onChange} = this.props;
    const widgetQuery = queries[queryIndex];

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(queryIndex, newQuery);
    };
  };

  getFirstQueryError(key: string) {
    const {errors} = this.props;

    if (!errors) {
      return undefined;
    }

    return errors.find(queryError => queryError && queryError[key]);
  }

  render() {
    const {
      canAddSearchConditions,
      displayType,
      errors,
      fieldOptions,
      organization,
      queries,
      selection,
      handleDeleteQuery,
      handleAddSearchConditions,
      onChange,
    } = this.props;

    const hideLegendAlias = ['table', 'world_map', 'big_number'].includes(displayType);
    const explodedFields = queries[0].fields.map(field => explodeField({field}));

    return (
      <QueryWrapper>
        {queries.map((widgetQuery, queryIndex) => {
          return (
            <Field
              key={queryIndex}
              label={queryIndex === 0 ? t('Query') : null}
              inline={false}
              style={{paddingBottom: `8px`}}
              flexibleControlStateSize
              stacked
              error={errors?.[queryIndex].conditions}
            >
              <SearchConditionsWrapper>
                <StyledMeticsSearchBar
                  searchSource="widget_builder"
                  orgSlug={organization.slug}
                  query={widgetQuery.conditions}
                  onSearch={field => {
                    // SearchBar will call handlers for both onSearch and onBlur
                    // when selecting a value from the autocomplete dropdown. This can
                    // cause state issues for the search bar in our use case. To prevent
                    // this, we set a timer in our onSearch handler to block our onBlur
                    // handler from firing if it is within 200ms, ie from clicking an
                    // autocomplete value.
                    this.blurTimeout = window.setTimeout(() => {
                      this.blurTimeout = null;
                    }, 200);
                    return this.handleFieldChange(queryIndex, 'conditions')(field);
                  }}
                  maxQueryLength={MAX_QUERY_LENGTH}
                  projectIds={selection.projects}
                />
                {!hideLegendAlias && (
                  <LegendAliasInput
                    type="text"
                    name="name"
                    required
                    value={widgetQuery.name}
                    placeholder={t('Legend Alias')}
                    onChange={event =>
                      this.handleFieldChange(queryIndex, 'name')(event.target.value)
                    }
                  />
                )}
                {queries.length > 1 && (
                  <Button
                    size="zero"
                    borderless
                    onClick={event => {
                      event.preventDefault();
                      handleDeleteQuery(queryIndex);
                    }}
                    icon={<IconDelete />}
                    title={t('Remove query')}
                    aria-label={t('Remove query')}
                  />
                )}
              </SearchConditionsWrapper>
            </Field>
          );
        })}
        {canAddSearchConditions && (
          <Button
            size="small"
            icon={<IconAdd isCircled />}
            onClick={(event: React.MouseEvent) => {
              event.preventDefault();
              handleAddSearchConditions();
            }}
          >
            {t('Add Query')}
          </Button>
        )}
        <WidgetQueryFields
          widgetType={WidgetType.METRICS}
          displayType={displayType}
          fieldOptions={fieldOptions}
          errors={this.getFirstQueryError('fields')}
          fields={explodedFields}
          organization={organization}
          onChange={fields => {
            const fieldStrings = fields.map(field => generateFieldAsString(field));
            queries.forEach((widgetQuery, queryIndex) => {
              const newQuery = cloneDeep(widgetQuery);
              newQuery.fields = fieldStrings;
              onChange(queryIndex, newQuery);
            });
          }}
        />
      </QueryWrapper>
    );
  }
}

export default MetricsWidgetQueriesForm;

const QueryWrapper = styled('div')`
  position: relative;
`;

export const SearchConditionsWrapper = styled('div')`
  display: flex;
  align-items: center;
  > * + * {
    margin-left: ${space(1)};
  }
`;

const LegendAliasInput = styled(Input)`
  width: 33%;
`;

const StyledMeticsSearchBar = styled(MetricsSearchBar)`
  flex-grow: 1;
`;
