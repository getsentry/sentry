import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Button from 'app/components/button';
import {PanelBody, PanelItem} from 'app/components/panels';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {
  explodeField,
  generateFieldAsString,
  QueryFieldValue,
} from 'app/utils/discover/fields';
import {WidgetQuery} from 'app/views/dashboardsV2/types';
import SearchBar from 'app/views/events/searchBar';
import {QueryField} from 'app/views/eventsV2/table/queryField';
import {generateFieldOptions} from 'app/views/eventsV2/utils';

type Props = {
  widgetQuery: WidgetQuery;
  organization: Organization;
  selection: GlobalSelection;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (widgetQuery: WidgetQuery) => void;
  canRemove: boolean;
  onRemove: () => void;
};

/**
 * Contain widget query interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
function WidgetQueryForm({
  canRemove,
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

  return (
    <PanelBody>
      <VerticalPanelItem>
        <Heading>
          {t('Conditions')}
          {canRemove && (
            <Button
              data-test-id="remove-query"
              priority="default"
              size="zero"
              borderless
              onClick={onRemove}
              icon={<IconDelete />}
              title={t('Remove this query')}
            />
          )}
        </Heading>
        <SearchBar
          organization={organization}
          projectIds={selection.projects}
          query={widgetQuery.conditions}
          fields={[]}
          onSearch={handleFieldChange('conditions')}
          onBlur={handleFieldChange('conditions')}
          useFormWrapper={false}
        />
      </VerticalPanelItem>
      <VerticalPanelItem>
        <Heading>{t('Fields')}</Heading>
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
        <div>
          <Button
            data-test-id="add-field"
            priority="default"
            size="zero"
            borderless
            onClick={handleAddField}
            icon={<IconAdd />}
            title={t('Add a field')}
          />
        </div>
      </VerticalPanelItem>
    </PanelBody>
  );
}

const Heading = styled('h3')`
  display: flex;
  justify-content: space-between;

  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0 0 ${space(1)} 0;
  line-height: 1.3;
`;

const VerticalPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
`;

export default WidgetQueryForm;
