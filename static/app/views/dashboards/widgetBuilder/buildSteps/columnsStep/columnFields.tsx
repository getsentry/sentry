import styled from '@emotion/styled';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import ColumnEditCollection from 'sentry/views/discover/table/columnEditCollection';
import {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {generateFieldOptions} from 'sentry/views/discover/utils';

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
    <FieldGroup
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
          showAliasField
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
    </FieldGroup>
  );
}

const ColumnCollectionEdit = styled(ColumnEditCollection)`
  margin-top: ${space(1)};
`;
