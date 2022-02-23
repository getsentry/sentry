import styled from '@emotion/styled';

import Field from 'sentry/components/forms/field';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import ColumnEditCollection from 'sentry/views/eventsV2/table/columnEditCollection';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {WidgetType} from '../types';

import {DisplayType} from './utils';

interface Props {
  columns: QueryFieldValue[];
  displayType: DisplayType;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (newColumns: QueryFieldValue[]) => void;
  organization: Organization;
  widgetType: WidgetType;
  errors?: Record<string, string>[];
}

export function ColumnFields({
  displayType,
  fieldOptions,
  widgetType,
  columns,
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
      required
    >
      {displayType === DisplayType.TABLE ? (
        <ColumnCollectionEdit
          columns={columns}
          onChange={onChange}
          fieldOptions={fieldOptions}
          organization={organization}
          source={widgetType}
        />
      ) : (
        <ColumnCollectionEdit
          columns={columns.slice(0, columns.length - 1)}
          onChange={newColumns => {
            onChange([...newColumns, columns[columns.length - 1]]);
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
