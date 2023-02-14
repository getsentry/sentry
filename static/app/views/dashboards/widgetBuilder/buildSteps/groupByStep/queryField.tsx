import {Fragment} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {QueryField as TableQueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

export interface QueryFieldProps {
  fieldOptions: React.ComponentProps<typeof TableQueryField>['fieldOptions'];
  onChange: (newValue: QueryFieldValue) => void;
  value: QueryFieldValue;
  attributes?: UseDraggableArguments['attributes'];
  canDelete?: boolean;
  canDrag?: boolean;
  forwardRef?: React.Ref<HTMLDivElement>;
  isDragging?: boolean;
  listeners?: DraggableSyntheticListeners;
  onDelete?: () => void;
  style?: React.CSSProperties;
}

export function QueryField({
  onDelete,
  onChange,
  fieldOptions,
  value,
  forwardRef,
  listeners,
  attributes,
  canDelete,
  canDrag,
  style,
  isDragging,
}: QueryFieldProps) {
  return (
    <QueryFieldWrapper ref={forwardRef} style={style}>
      {isDragging ? null : (
        <Fragment>
          {canDrag && (
            <DragAndReorderButton
              {...listeners}
              {...attributes}
              aria-label={t('Drag to reorder')}
              icon={<IconGrabbable size="xs" />}
              size="zero"
              borderless
            />
          )}
          <TableQueryField
            placeholder={t('Select group')}
            fieldValue={value}
            fieldOptions={fieldOptions}
            onChange={onChange}
            filterPrimaryOptions={option => option.value.kind !== FieldValueKind.FUNCTION}
          />
          {canDelete && (
            <Button
              size="zero"
              borderless
              onClick={onDelete}
              icon={<IconDelete />}
              title={t('Remove group')}
              aria-label={t('Remove group')}
            />
          )}
        </Fragment>
      )}
    </QueryFieldWrapper>
  );
}

const DragAndReorderButton = styled(Button)`
  height: ${p => p.theme.form.md.height}px;
`;

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  > * + * {
    margin-left: ${space(1)};
  }
`;
