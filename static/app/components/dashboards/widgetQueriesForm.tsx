import * as React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import Button from 'app/components/button';
import SearchBar from 'app/components/events/searchBar';
import SelectControl from 'app/components/forms/selectControl';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, SelectValue} from 'app/types';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import WidgetQueryFields from './widgetQueryFields';

const generateOrderOptions = (fields: string[]): SelectValue<string>[] => {
  const options: SelectValue<string>[] = [];
  fields.forEach(field => {
    const alias = getAggregateAlias(field);
    options.push({label: t('%s asc', field), value: alias});
    options.push({label: t('%s desc', field), value: `-${alias}`});
  });
  return options;
};

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  displayType: Widget['displayType'];
  queries: WidgetQuery[];
  errors?: Array<Record<string, any>>;
  onChange: (queryIndex: number, widgetQuery: WidgetQuery) => void;
  canAddSearchConditions: boolean;
  handleAddSearchConditions: () => void;
  handleDeleteQuery: (queryIndex: number) => void;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
};

/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class WidgetQueriesForm extends React.Component<Props> {
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
      organization,
      selection,
      errors,
      queries,
      canAddSearchConditions,
      handleAddSearchConditions,
      handleDeleteQuery,
      displayType,
      fieldOptions,
      onChange,
    } = this.props;

    const hideLegendAlias = ['table', 'world_map', 'big_number'].includes(displayType);

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
                <StyledSearchBar
                  searchSource="widget_builder"
                  organization={organization}
                  projectIds={selection.projects}
                  query={widgetQuery.conditions}
                  fields={[]}
                  onSearch={this.handleFieldChange(queryIndex, 'conditions')}
                  onBlur={this.handleFieldChange(queryIndex, 'conditions')}
                  useFormWrapper={false}
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
                    label={t('Remove query')}
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
          displayType={displayType}
          fieldOptions={fieldOptions}
          errors={this.getFirstQueryError('fields')}
          fields={queries[0].fields}
          organization={organization}
          onChange={fields => {
            queries.forEach((widgetQuery, queryIndex) => {
              const newQuery = cloneDeep(widgetQuery);
              newQuery.fields = fields;
              onChange(queryIndex, newQuery);
            });
          }}
        />
        {displayType === 'table' && (
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
              options={generateOrderOptions(queries[0].fields)}
              onChange={(option: SelectValue<string>) =>
                this.handleFieldChange(0, 'orderby')(option.value)
              }
              onSelectResetsInput={false}
              onCloseResetsInput={false}
              onBlurResetsInput={false}
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
