import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

const GROUP_BY_LIMIT = 20;

type Props = {
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  fields: QueryFieldValue[];
  onChange: (fields: QueryFieldValue[]) => void;
  columns?: QueryFieldValue[];
};

export function GroupBy({fieldOptions, columns, onChange, fields}: Props) {
  function handleAdd() {
    const newFields = [
      ...fields,
      {kind: FieldValueKind.FIELD, field: ''} as QueryFieldValue,
    ];
    onChange(newFields);
  }

  return (
    <React.Fragment>
      <StyledField inline={false} flexibleControlStateSize stacked>
        {columns?.map((column, index) => (
          // TODO(nar): Find a better key. Should be able to use column.field
          // because we're filtering out functions
          <QueryFieldWrapper key={`${column.kind}-${index}`}>
            <QueryField
              placeholder={t('Select group')}
              fieldValue={column}
              fieldOptions={fieldOptions}
              onChange={() => {}}
            />
          </QueryFieldWrapper>
        ))}
      </StyledField>

      {(columns?.length ?? 0) < GROUP_BY_LIMIT && (
        <AddGroupButton size="small" icon={<IconAdd isCircled />} onClick={handleAdd}>
          {t('Add Group')}
        </AddGroupButton>
      )}
    </React.Fragment>
  );
}

const StyledField = styled(Field)`
  padding-bottom: ${space(1)};
`;

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  > * + * {
    margin-left: ${space(1)};
  }
`;

const AddGroupButton = styled(Button)`
  width: min-content;
`;
