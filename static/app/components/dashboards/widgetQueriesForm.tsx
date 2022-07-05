import {Component} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import Button from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  explodeField,
  generateFieldAsString,
  getColumnsAndAggregatesAsStrings,
  isEquation,
  stripDerivedMetricsPrefix,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {Widget, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {ReleaseSearchBar} from 'sentry/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar';
import {
  DISABLED_SORT,
  TAG_SORT_DENY_LIST,
} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import WidgetQueryFields from './widgetQueryFields';

export const generateOrderOptions = ({
  aggregates,
  columns,
  widgetType,
  widgetBuilderNewDesign = false,
}: {
  aggregates: string[];
  columns: string[];
  widgetType: WidgetType;
  widgetBuilderNewDesign?: boolean;
}): SelectValue<string>[] => {
  const isRelease = widgetType === WidgetType.RELEASE;
  const options: SelectValue<string>[] = [];
  let equations = 0;
  (isRelease
    ? [...aggregates.map(stripDerivedMetricsPrefix), ...columns]
    : [...aggregates, ...columns]
  )
    .filter(field => !!field)
    .filter(field => !DISABLED_SORT.includes(field))
    .filter(field => (isRelease ? !TAG_SORT_DENY_LIST.includes(field) : true))
    .forEach(field => {
      let alias;
      const label = stripEquationPrefix(field);
      // Equations are referenced via a standard alias following this pattern
      if (isEquation(field)) {
        alias = `equation[${equations}]`;
        equations += 1;
      }

      if (widgetBuilderNewDesign) {
        options.push({label, value: alias ?? field});
        return;
      }

      options.push({
        label: t('%s asc', label),
        value: alias ?? field,
      });

      options.push({
        label: t('%s desc', label),
        value: `-${alias ?? field}`,
      });
    });

  return options;
};

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
  widgetType?: Widget['widgetType'];
};

/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class WidgetQueriesForm extends Component<Props> {
  componentWillUnmount() {
    window.clearTimeout(this.blurTimeout);
  }

  blurTimeout: number | undefined = undefined;

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

  renderSearchBar(widgetQuery: WidgetQuery, queryIndex: number) {
    const {organization, selection, widgetType} = this.props;

    return widgetType === WidgetType.RELEASE ? (
      <ReleaseSearchBar
        organization={organization}
        widgetQuery={widgetQuery}
        onSearch={field => {
          // SearchBar will call handlers for both onSearch and onBlur
          // when selecting a value from the autocomplete dropdown. This can
          // cause state issues for the search bar in our use case. To prevent
          // this, we set a timer in our onSearch handler to block our onBlur
          // handler from firing if it is within 200ms, ie from clicking an
          // autocomplete value.
          window.clearTimeout(this.blurTimeout);
          this.blurTimeout = window.setTimeout(() => {
            this.blurTimeout = undefined;
          }, 200);
          return this.handleFieldChange(queryIndex, 'conditions')(field);
        }}
        onBlur={field => {
          if (!this.blurTimeout) {
            this.handleFieldChange(queryIndex, 'conditions')(field);
          }
        }}
        pageFilters={selection}
      />
    ) : (
      <StyledSearchBar
        searchSource="widget_builder"
        organization={organization}
        projectIds={selection.projects}
        query={widgetQuery.conditions}
        fields={[]}
        onSearch={field => {
          // SearchBar will call handlers for both onSearch and onBlur
          // when selecting a value from the autocomplete dropdown. This can
          // cause state issues for the search bar in our use case. To prevent
          // this, we set a timer in our onSearch handler to block our onBlur
          // handler from firing if it is within 200ms, ie from clicking an
          // autocomplete value.
          if (this.blurTimeout) {
            window.clearTimeout(this.blurTimeout);
          }
          this.blurTimeout = window.setTimeout(() => {
            this.blurTimeout = undefined;
          }, 200);
          this.handleFieldChange(queryIndex, 'conditions')(field);
        }}
        onBlur={field => {
          if (!this.blurTimeout) {
            this.handleFieldChange(queryIndex, 'conditions')(field);
          }
        }}
        useFormWrapper={false}
        maxQueryLength={MAX_QUERY_LENGTH}
      />
    );
  }

  render() {
    const {
      organization,
      errors,
      queries,
      canAddSearchConditions,
      handleAddSearchConditions,
      handleDeleteQuery,
      displayType,
      fieldOptions,
      onChange,
      widgetType = WidgetType.DISCOVER,
    } = this.props;

    const hideLegendAlias = ['table', 'world_map', 'big_number'].includes(displayType);
    const query = queries[0];
    const explodedFields = defined(query.fields)
      ? query.fields.map(field => explodeField({field}))
      : [...query.columns, ...query.aggregates].map(field => explodeField({field}));

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
                {this.renderSearchBar(widgetQuery, queryIndex)}
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
          widgetType={widgetType}
          displayType={displayType}
          fieldOptions={fieldOptions}
          errors={this.getFirstQueryError('fields')}
          fields={explodedFields}
          organization={organization}
          onChange={fields => {
            const {aggregates, columns} = getColumnsAndAggregatesAsStrings(fields);
            const fieldStrings = fields.map(field => generateFieldAsString(field));

            queries.forEach((widgetQuery, queryIndex) => {
              const newQuery = cloneDeep(widgetQuery);
              newQuery.fields = fieldStrings;
              newQuery.aggregates = aggregates;
              newQuery.columns = columns;
              if (defined(widgetQuery.orderby)) {
                const descending = widgetQuery.orderby.startsWith('-');
                const orderby = widgetQuery.orderby.replace('-', '');
                const prevFieldStrings = defined(widgetQuery.fields)
                  ? widgetQuery.fields
                  : [...widgetQuery.columns, ...widgetQuery.aggregates];
                if (!aggregates.includes(orderby) && widgetQuery.orderby !== '') {
                  if (prevFieldStrings.length === fields.length) {
                    // The Field that was used in orderby has changed. Get the new field.
                    newQuery.orderby = `${descending ? '-' : ''}${
                      aggregates[prevFieldStrings.indexOf(orderby)]
                    }`;
                  } else {
                    newQuery.orderby = '';
                  }
                }
              }
              onChange(queryIndex, newQuery);
            });
          }}
        />
        {['table', 'top_n'].includes(displayType) && (
          <Field
            label={t('Sort by')}
            inline={false}
            flexibleControlStateSize
            stacked
            error={this.getFirstQueryError('orderby')?.orderby}
            style={{marginBottom: space(1)}}
          >
            <SelectControl
              value={queries[0].orderby}
              name="orderby"
              options={generateOrderOptions({
                widgetType,
                columns: queries[0].columns,
                aggregates: queries[0].aggregates,
              })}
              onChange={(option: SelectValue<string>) =>
                this.handleFieldChange(0, 'orderby')(option.value)
              }
            />
          </Field>
        )}
      </QueryWrapper>
    );
  }
}

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

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const LegendAliasInput = styled(Input)`
  width: 33%;
`;

export default WidgetQueriesForm;
