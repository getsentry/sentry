import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

const GROUP_BY_LIMIT = 20;
const EMPTY_FIELD: QueryFieldValue = {kind: FieldValueKind.FIELD, field: ''};

type Props = {
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  fields: QueryFieldValue[];
  onChange: (fields: QueryFieldValue[]) => void;
  columns?: QueryFieldValue[];
};

export function GroupBy({fieldOptions, columns = [], onChange}: Props) {
  function handleAdd() {
    const newColumns =
      columns.length === 0
        ? [{...EMPTY_FIELD}, {...EMPTY_FIELD}]
        : [...columns, {...EMPTY_FIELD}];
    onChange(newColumns);
  }

  function handleSelect(value: QueryFieldValue, index?: number) {
    const newColumns = [...columns];
    if (columns.length === 0) {
      newColumns.push(value);
    } else if (defined(index)) {
      newColumns[index] = value;
    }
    onChange(newColumns);
  }

  function handleRemove(index: number) {
    const newColumns = [...columns];
    newColumns.splice(index, 1);
    onChange(newColumns);
  }

  if (columns.length === 0) {
    return (
      <React.Fragment>
        <StyledField inline={false} flexibleControlStateSize stacked>
          <QueryFieldWrapper>
            <QueryField
              placeholder={t('Select group')}
              fieldValue={EMPTY_FIELD}
              fieldOptions={fieldOptions}
              onChange={value => handleSelect(value, 0)}
            />
          </QueryFieldWrapper>
        </StyledField>

        <AddGroupButton size="small" icon={<IconAdd isCircled />} onClick={handleAdd}>
          {t('Add Group')}
        </AddGroupButton>
      </React.Fragment>
    );
  }

  const canDelete =
    // TODO: This should only show delete options if there are no columns
    // or if we've initialized a blank one and it's the only one left
    // @ts-ignore
    columns.length > 1 || (columns.length === 1 && columns[0]?.field !== '');

  return (
    <React.Fragment>
      <StyledField inline={false} flexibleControlStateSize stacked>
        {columns?.map((column, index) => (
          <QueryFieldWrapper key={`groupby-${index}`}>
            <QueryField
              placeholder={t('Select group')}
              fieldValue={column}
              fieldOptions={fieldOptions}
              onChange={value => handleSelect(value, index)}
            />
            {canDelete && (
              <Button
                size="zero"
                borderless
                onClick={() => handleRemove(index)}
                icon={<IconDelete />}
                title={t('Remove group')}
                aria-label={t('Remove group')}
              />
            )}
          </QueryFieldWrapper>
        ))}
      </StyledField>

      {columns.length < GROUP_BY_LIMIT && (
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
