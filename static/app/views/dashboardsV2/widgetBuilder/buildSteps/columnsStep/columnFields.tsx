import styled from '@emotion/styled';

import Field from 'sentry/components/forms/field';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import ColumnEditCollection from 'sentry/views/eventsV2/table/columnEditCollection';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {WidgetType} from '../../../types';
import {DisplayType} from '../../utils';

interface Props {
  aggregates: QueryFieldValue[];
  columns: QueryFieldValue[];
  displayType: DisplayType;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  fields: QueryFieldValue[];
  onChange: (newColumns: QueryFieldValue[]) => void;
  organization: Organization;
  widgetType: WidgetType;
  errors?: Record<string, string>[];
}

export function ColumnFields({
  aggregates,
  columns,
  displayType,
  fieldOptions,
  widgetType,
  fields,
  organization,
  errors,
  onChange,
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
        />
      ) : (
        <ColumnCollectionEdit
          columns={[...columns, ...aggregates.slice(0, aggregates.length - 1)]}
          onChange={newColumns => {
            onChange([...newColumns, fields[fields.length - 1]]);
          }}
          fieldOptions={fieldOptions}
          organization={organization}
          source={widgetType}
        />
      )}
    </Field>
  );
}

const ColumnCollectionEdit = styled(ColumnEditCollection)`
  margin-top: ${space(1)};
`;
