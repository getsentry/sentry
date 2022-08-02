import styled from '@emotion/styled';

import Field from 'sentry/components/forms/field';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import ColumnEditCollection from 'sentry/views/eventsV2/table/columnEditCollection';
import {FieldValueOption} from 'sentry/views/eventsV2/table/queryField';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

interface Props {
  displayType: DisplayType;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  fields: QueryFieldValue[];
  onChange: (newColumns: QueryFieldValue[]) => void;
  organization: Organization;
  widgetType: WidgetType;
  errors?: Record<string, string>[];
  filterAggregateParameters?: (option: FieldValueOption) => boolean;
  filterPrimaryOptions?: (option: FieldValueOption) => boolean;
  noFieldsMessage?: string;
}

export function ColumnFields({
  displayType,
  fieldOptions,
  widgetType,
  fields,
  organization,
  errors,
  onChange,
  filterAggregateParameters,
  filterPrimaryOptions,
  noFieldsMessage,
}: Props) {
  return (
    <Field
      inline={false}
      error={errors?.find(error => error?.fields)?.fields}
      flexibleControlStateSize
      stacked
    >
      {displayType === DisplayType.TABLE ? (
        <ColumnCollectionEdit
          columns={fields}
          onChange={onChange}
          fieldOptions={fieldOptions}
          organization={organization}
          source={widgetType}
          showAliasField={organization.features.includes(
            'new-widget-builder-experience-design'
          )}
          filterAggregateParameters={filterAggregateParameters}
          filterPrimaryOptions={filterPrimaryOptions}
          noFieldsMessage={noFieldsMessage}
        />
      ) : (
        // The only other display type this component
        // renders for is TOP_N, where the n - 1 fields
        // are columns and the nth field is the y-axis
        <ColumnCollectionEdit
          columns={fields.slice(0, fields.length - 1)}
          onChange={newColumns => {
            onChange([...newColumns, fields[fields.length - 1]]);
          }}
          fieldOptions={fieldOptions}
          organization={organization}
          source={widgetType}
          filterPrimaryOptions={filterPrimaryOptions}
          noFieldsMessage={noFieldsMessage}
        />
      )}
    </Field>
  );
}

const ColumnCollectionEdit = styled(ColumnEditCollection)`
  margin-top: ${space(1)};
`;
