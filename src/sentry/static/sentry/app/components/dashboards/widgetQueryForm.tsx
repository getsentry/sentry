import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {fetchSavedQueries} from 'app/actionCreators/discoverSavedQueries';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import SelectControl from 'app/components/forms/selectControl';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, SavedQuery, SelectValue} from 'app/types';
import {
  explodeField,
  generateFieldAsString,
  QueryFieldValue,
} from 'app/utils/discover/fields';
import {WidgetQuery} from 'app/views/dashboardsV2/types';
import SearchBar from 'app/views/events/searchBar';
import {QueryField} from 'app/views/eventsV2/table/queryField';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import Input from 'app/views/settings/components/forms/controls/input';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import Field from 'app/views/settings/components/forms/field';

type Props = {
  api: Client;
  widgetQuery: WidgetQuery;
  organization: Organization;
  selection: GlobalSelection;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (widgetQuery: WidgetQuery) => void;
  canRemove: boolean;
  onRemove: () => void;
  errors?: Record<string, any>;
};

type State = {
  selectedQuery: string | null;
  source: string;
};

type SavedQueryOption = SelectValue<string> & {query: SavedQuery};

/**
 * Contain widget query interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class WidgetQueryForm extends React.Component<Props, State> {
  state: State = {
    selectedQuery: null,
    source: 'new',
  };

  // Handle scalar field values changing.
  handleFieldChange = (field: string) => {
    const {widgetQuery, onChange} = this.props;

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(newQuery);
    };
  };

  // Handle new fields being added.
  handleAddField = (event: React.MouseEvent) => {
    const {widgetQuery, onChange} = this.props;
    event.preventDefault();

    const newQuery = {...widgetQuery, fields: [...widgetQuery.fields, '']};
    onChange(newQuery);
  };

  // Remove fields from the field list and signal an update.
  handleRemoveField = (event: React.MouseEvent, fieldIndex: number) => {
    const {widgetQuery, onChange} = this.props;
    event.preventDefault();

    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields.splice(fieldIndex, fieldIndex + 1);
    onChange(newQuery);
  };

  handleQueryField = (fieldIndex: number, value: QueryFieldValue) => {
    const {widgetQuery, onChange} = this.props;
    const newQuery = cloneDeep(widgetQuery);
    set(newQuery, `fields.${fieldIndex}`, generateFieldAsString(value));
    onChange(newQuery);
  };

  handleSavedQueryChange = ({query, value}: SavedQueryOption) => {
    const {onChange, widgetQuery} = this.props;

    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields = [query.yAxis ?? 'count()'];
    newQuery.conditions = query.query ?? '';
    newQuery.name = query.name;
    onChange(newQuery);

    this.setState({selectedQuery: value});
  };

  handleLoadOptions = (inputValue: string) => {
    const {api, organization} = this.props;
    return new Promise((resolve, reject) => {
      fetchSavedQueries(api, organization.slug, inputValue)
        .then((queries: SavedQuery[]) => {
          const results = queries.map(query => ({
            label: query.name,
            value: query.id,
            query,
          }));
          resolve(results);
        })
        .catch(reject);
    });
  };

  handleSourceChange = (value: string) => {
    this.setState(prevState => {
      return {
        ...prevState,
        source: value,
        selectedQuery: value === 'new' ? null : prevState.selectedQuery,
      };
    });
  };

  render() {
    const {
      canRemove,
      errors,
      fieldOptions,
      organization,
      selection,
      widgetQuery,
    } = this.props;
    const {selectedQuery, source} = this.state;

    return (
      <div>
        {canRemove && (
          <RemoveButtonWrapper>
            <Button
              data-test-id="remove-query"
              priority="default"
              size="zero"
              borderless
              onClick={this.props.onRemove}
              icon={<IconDelete />}
              title={t('Remove this query')}
            />
          </RemoveButtonWrapper>
        )}
        <Field
          data-test-id="source"
          label="Source"
          inline={false}
          flexibleControlStateSize
          stacked
        >
          <RadioGroup
            orientInline
            value={this.state.source}
            label=""
            onChange={this.handleSourceChange}
            choices={[
              ['new', t('New Query')],
              ['existing', t('Existing Discover Query')],
            ]}
          />
        </Field>
        {source === 'new' && (
          <Field
            data-test-id="new-query"
            label="New Query"
            inline={false}
            flexibleControlStateSize
            stacked
            error={errors?.conditions}
          >
            <SearchBar
              organization={organization}
              projectIds={selection.projects}
              query={widgetQuery.conditions}
              fields={[]}
              onSearch={this.handleFieldChange('conditions')}
              onBlur={this.handleFieldChange('conditions')}
              useFormWrapper={false}
            />
          </Field>
        )}
        {source === 'existing' && (
          <Feature organization={organization} features={['discover-query']}>
            {({hasFeature}) => (
              <Field
                data-test-id="discover-query"
                label="Existing Discover Query"
                inline={false}
                flexibleControlStateSize
                stacked
              >
                <SelectControl
                  async
                  defaultOptions
                  value={selectedQuery}
                  name="discoverQuery"
                  loadOptions={this.handleLoadOptions}
                  onChange={this.handleSavedQueryChange}
                  options={[]}
                  disabled={!hasFeature}
                  cache
                  onSelectResetsInput={false}
                  onCloseResetsInput={false}
                  onBlurResetsInput={false}
                />
              </Field>
            )}
          </Feature>
        )}
        {canRemove && (
          <Field
            data-test-id="Query Name"
            label="Y-Axis"
            inline={false}
            flexibleControlStateSize
            stacked
            error={errors?.name}
          >
            <Input
              type="text"
              name="name"
              required
              value={widgetQuery.name}
              onChange={event => this.handleFieldChange('name')(event.target.value)}
            />
          </Field>
        )}
        <Field
          data-test-id="y-axis"
          label="Y-Axis"
          inline={false}
          flexibleControlStateSize
          stacked
          error={errors?.fields}
        >
          {widgetQuery.fields.map((field, i) => (
            <QueryFieldWrapper key={`${field}:${i}`}>
              <QueryField
                fieldValue={explodeField({field})}
                fieldOptions={fieldOptions}
                onChange={value => this.handleQueryField(i, value)}
              />
              {widgetQuery.fields.length > 1 && (
                <Button
                  priority="default"
                  size="zero"
                  borderless
                  onClick={event => this.handleRemoveField(event, i)}
                  icon={<IconDelete />}
                  title={t('Remove this field')}
                />
              )}
            </QueryFieldWrapper>
          ))}
          <div>
            <Button
              data-test-id="add-field"
              priority="default"
              size="zero"
              borderless
              onClick={this.handleAddField}
              icon={<IconAdd />}
            >
              {t('Add an overlay')}
            </Button>
          </div>
        </Field>
      </div>
    );
  }
}

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
`;

const RemoveButtonWrapper = styled('div')`
  position: absolute;
  top: ${space(2)};
  right: ${space(2)};
`;

export default WidgetQueryForm;
