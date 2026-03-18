import {Fragment, type ReactNode} from 'react';
import type {DraggableAttributes, DraggableSyntheticListeners} from '@dnd-kit/core';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {QueryField as TableQueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind, type FieldValue} from 'sentry/views/discover/table/types';

export interface QueryFieldProps {
  fieldOptions: React.ComponentProps<typeof TableQueryField>['fieldOptions'];
  onChange: (newValue: QueryFieldValue) => void;
  value: QueryFieldValue;
  attributes?: DraggableAttributes;
  canDelete?: boolean;
  canDrag?: boolean;
  disabled?: boolean;
  extraActions?: ReactNode;
  fieldValidationError?: ReactNode;
  isDragging?: boolean;
  listeners?: DraggableSyntheticListeners;
  onDelete?: () => void;
  ref?: React.Ref<HTMLDivElement>;
  renderTagOverride?: (
    kind: FieldValueKind,
    label: ReactNode,
    meta: FieldValue['meta']
  ) => ReactNode;
  style?: React.CSSProperties;
}

export function QueryField({
  onDelete,
  onChange,
  fieldOptions,
  value,
  ref,
  listeners,
  attributes,
  canDelete,
  canDrag,
  style,
  fieldValidationError,
  isDragging,
  disabled,
  extraActions,
  renderTagOverride,
}: QueryFieldProps) {
  return (
    <QueryFieldWrapper ref={ref} style={style}>
      {isDragging ? null : (
        <Fragment>
          {canDrag && <StyledDragReorderButton {...listeners} {...attributes} />}
          <TableQueryField
            placeholder={t('Select group')}
            fieldValue={value}
            fieldOptions={fieldOptions}
            onChange={onChange}
            disabled={disabled}
            filterPrimaryOptions={option => option.value.kind !== FieldValueKind.FUNCTION}
            renderTagOverride={renderTagOverride}
          />
          {fieldValidationError ? fieldValidationError : null}
          {extraActions}
          {canDelete && (
            <Button
              size="zero"
              priority="transparent"
              onClick={onDelete}
              icon={<IconDelete />}
              tooltipProps={{title: t('Remove group')}}
              aria-label={t('Remove group')}
              disabled={disabled}
            />
          )}
        </Fragment>
      )}
    </QueryFieldWrapper>
  );
}

const StyledDragReorderButton = styled(DragReorderButton)`
  height: ${p => p.theme.form.md.height};
`;

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  > * + * {
    margin-left: ${p => p.theme.space.md};
  }
`;
