import * as React from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {Transform} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconDelete, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {QueryField as TableQueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

export interface QueryFieldProps {
  fieldOptions: React.ComponentProps<typeof TableQueryField>['fieldOptions'];
  onChange: (newValue: QueryFieldValue) => void;
  value: QueryFieldValue;
  actions?: boolean;
  forwardRef?: React.Ref<HTMLDivElement>;
  ghost?: boolean;
  grabAttributes?: UseDraggableArguments['attributes'];
  listeners?: DraggableSyntheticListeners;
  onDelete?: () => void;
  transform?: Transform | null;
  transition?: string | null;
  wrapperStyle?: React.CSSProperties;
}

export function QueryField({
  onDelete,
  onChange,
  fieldOptions,
  value,
  forwardRef,
  listeners,
  grabAttributes,
  actions,
  ghost,
  wrapperStyle,
  transform,
  transition,
}: QueryFieldProps) {
  const content = (
    <QueryFieldWrapper
      ref={forwardRef}
      style={
        {
          ...wrapperStyle,
          transition,
          '--translate-x': transform ? `${Math.round(transform.x)}px` : undefined,
          '--translate-y': transform ? `${Math.round(transform.y)}px` : undefined,
          '--scale-x': transform?.scaleX ? `${transform.scaleX}` : undefined,
          '--scale-y': transform?.scaleY ? `${transform.scaleY}` : undefined,
        } as React.CSSProperties
      }
    >
      {actions && (
        <DragAndReorderButton
          {...listeners}
          {...grabAttributes}
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
      {actions && (
        <Button
          size="zero"
          borderless
          onClick={onDelete}
          icon={<IconDelete />}
          title={t('Remove group')}
          aria-label={t('Remove group')}
        />
      )}
    </QueryFieldWrapper>
  );

  if (ghost) {
    return <Ghost>{content}</Ghost>;
  }

  return content;
}

const DragAndReorderButton = styled(Button)`
  height: 40px;
`;

const Ghost = styled('div')`
  transform: translate3d(var(--translate-x, 0), var(--translate-y, 0), 0)
    scaleX(var(--scale-x, 1)) scaleY(var(--scale-y, 1));
  transform-origin: 0 0;
  touch-action: manipulation;

  background: ${p => p.theme.background};
  display: block;
  position: absolute;
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  width: 710px;
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${space(2)};

  button {
    cursor: grabbing;
  }
`;

const QueryFieldWrapper = styled('div')`
  animation: pop 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);

  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  > * + * {
    margin-left: ${space(1)};
  }
`;
