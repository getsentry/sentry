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
import Field from 'app/views/settings/components/forms/field';
import FieldErrorReason from 'app/views/settings/components/forms/field/fieldErrorReason';

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

type SavedQueryOption = SelectValue<SavedQuery>;

/**
 * Contain widget query interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
function WidgetQueryForm({
  api,
  canRemove,
  errors,
  fieldOptions,
  onChange,
  onRemove,
  organization,
  selection,
  widgetQuery,
}: Props) {
  // Handle scalar field values changing.
  function handleFieldChange(field: string) {
    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(newQuery);
    };
  }

  // Handle new fields being added.
  function handleAddField(event: React.MouseEvent) {
    event.preventDefault();

    const newQuery = {...widgetQuery, fields: [...widgetQuery.fields, '']};
    onChange(newQuery);
  }

  // Remove fields from the field list and signal an update.
  function handleRemoveField(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields.splice(fieldIndex, fieldIndex + 1);
    onChange(newQuery);
  }

  function handleQueryField(fieldIndex: number, value: QueryFieldValue) {
    const newQuery = cloneDeep(widgetQuery);
    set(newQuery, `fields.${fieldIndex}`, generateFieldAsString(value));
    onChange(newQuery);
  }

  function handleSavedQueryChange({value}: SavedQueryOption) {
    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields = [value.yAxis ?? 'count()'];
    newQuery.conditions = value.query ?? '';
    newQuery.name = value.name;
    onChange(newQuery);
  }

  function handleLoadOptions(inputValue: string) {
    return new Promise((resolve, reject) => {
      fetchSavedQueries(api, organization.slug, inputValue)
        .then((queries: SavedQuery[]) => {
          const results = queries.map(query => ({
            label: query.name,
            value: query,
          }));
          resolve(results);
        })
        .catch(reject);
    });
  }

  return (
    <div>
      {canRemove && (
        <RemoveButtonWrapper>
          <Button
            data-test-id="remove-query"
            priority="default"
            size="zero"
            borderless
            onClick={onRemove}
            icon={<IconDelete />}
            title={t('Remove this query')}
          />
        </RemoveButtonWrapper>
      )}
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
          onSearch={handleFieldChange('conditions')}
          onBlur={handleFieldChange('conditions')}
          useFormWrapper={false}
        />
      </Field>
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
              value=""
              name="discoverQuery"
              loadOptions={handleLoadOptions}
              onChange={handleSavedQueryChange}
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
      {canRemove && (
        <div>
          <Input
            type="text"
            name="name"
            required
            value={widgetQuery.name}
            onChange={event => handleFieldChange('name')(event.target.value)}
          />
          {errors?.name && <FieldErrorReason>{errors.name}</FieldErrorReason>}
        </div>
      )}
      <Field
        data-test-id="y-axis"
        label="Y-Axis"
        inline={false}
        flexibleControlStateSize
        stacked
      >
        {widgetQuery.fields.map((field, i) => (
          <QueryFieldWrapper key={`${field}:${i}`}>
            <QueryField
              fieldValue={explodeField({field})}
              fieldOptions={fieldOptions}
              onChange={value => handleQueryField(i, value)}
            />
            {widgetQuery.fields.length > 1 && (
              <Button
                priority="default"
                size="zero"
                borderless
                onClick={event => handleRemoveField(event, i)}
                icon={<IconDelete />}
                title={t('Remove this field')}
              />
            )}
          </QueryFieldWrapper>
        ))}
        {errors?.fields && <FieldErrorReason>{errors.fields}</FieldErrorReason>}
        <div>
          <Button
            data-test-id="add-field"
            priority="default"
            size="zero"
            borderless
            onClick={handleAddField}
            icon={<IconAdd />}
          >
            {t('Add an overlay')}
          </Button>
        </div>
      </Field>
    </div>
  );
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
