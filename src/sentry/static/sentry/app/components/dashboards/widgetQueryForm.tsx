import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Client} from 'app/api';
import Button from 'app/components/button';
import SearchBar from 'app/components/events/searchBar';
import SelectControl from 'app/components/forms/selectControl';
import {IconDelete} from 'app/icons';
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
  api: Client;
  widgetQuery: WidgetQuery;
  organization: Organization;
  selection: GlobalSelection;
  displayType: Widget['displayType'];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (widgetQuery: WidgetQuery) => void;
  canRemove: boolean;
  onRemove: () => void;
  errors?: Record<string, any>;
};

/**
 * Contain widget query interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class WidgetQueryForm extends React.Component<Props> {
  // Handle scalar field values changing.
  handleFieldChange = (field: string) => {
    const {widgetQuery, onChange} = this.props;

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(newQuery);
    };
  };

  handleFieldsChange = (fields: string[]) => {
    const {widgetQuery, onChange} = this.props;
    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields = fields;
    onChange(newQuery);
  };

  render() {
    const {
      canRemove,
      displayType,
      errors,
      fieldOptions,
      organization,
      selection,
      widgetQuery,
    } = this.props;

    return (
      <QueryWrapper>
        {canRemove && (
          <DeleteRow>
            <Button
              data-test-id="remove-query"
              size="xsmall"
              priority="danger"
              onClick={this.props.onRemove}
              icon={<IconDelete />}
            />
          </DeleteRow>
        )}
        <Field
          data-test-id="new-query"
          label={t('Query')}
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
        {canRemove && (
          <Field
            data-test-id="Query Name"
            label={t('Legend Alias')}
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
        <WidgetQueryFields
          displayType={displayType}
          fieldOptions={fieldOptions}
          errors={errors}
          fields={widgetQuery.fields}
          onChange={this.handleFieldsChange}
        />
        {displayType === 'table' && (
          <Field
            label={t('Sort by')}
            inline={false}
            flexibleControlStateSize
            stacked
            error={errors?.orderby}
          >
            <SelectControl
              value={widgetQuery.orderby}
              name="orderby"
              options={generateOrderOptions(widgetQuery.fields)}
              onChange={(option: SelectValue<string>) =>
                this.handleFieldChange('orderby')(option.value)
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
  padding-bottom: ${space(3)};
  position: relative;
`;

const DeleteRow = styled('div')`
  text-align: right;
`;

export default WidgetQueryForm;
