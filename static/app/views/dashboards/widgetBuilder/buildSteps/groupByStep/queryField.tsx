import {Fragment, useMemo, type ReactNode} from 'react';
import type {DraggableAttributes, DraggableSyntheticListeners} from '@dnd-kit/core';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {SelectValue} from '@sentry/scraps/select';

import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DEPRECATED_FIELDS, type QueryFieldValue} from 'sentry/utils/discover/fields';
import {prettifyTagKey, type FieldValueType} from 'sentry/utils/fields';
import {FieldValueKind, type FieldValue} from 'sentry/views/discover/table/types';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

export interface QueryFieldProps {
  fieldOptions: Record<string, SelectValue<FieldValue>>;
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
  const selectedValue =
    value.kind === FieldValueKind.FIELD || value.kind === 'calculatedField'
      ? value.field
      : '';

  // Group bys can only be columns, so functions are never offered. Options are
  // keyed by name, which is what gets stored on the widget's fields.
  const fieldValuesByName = useMemo(() => {
    const result = new Map<string, SelectValue<FieldValue>>();
    for (const option of Object.values(fieldOptions)) {
      if (
        option.value.kind !== FieldValueKind.FUNCTION &&
        !result.has(option.value.meta.name)
      ) {
        result.set(option.value.meta.name, option);
      }
    }
    return result;
  }, [fieldOptions]);

  const options = useMemo(() => {
    const result: Array<SelectOption<string>> = [];
    for (const [name, option] of fieldValuesByName) {
      result.push({
        value: name,
        label: option.label,
        textValue: typeof option.label === 'string' ? option.label : name,
        trailingItems: () =>
          renderTagOverride
            ? renderTagOverride(option.value.kind, option.label, option.value.meta)
            : renderTag(option.value),
      });
    }

    // Keep the selected field present even when it isn't in the options (e.g. a
    // tag that no longer exists in the selected time range) so the saved value
    // is still shown instead of the placeholder.
    if (selectedValue && !fieldValuesByName.has(selectedValue)) {
      result.push({
        value: selectedValue,
        label: prettifyTagKey(selectedValue),
        textValue: selectedValue,
      });
    }
    return result;
  }, [fieldValuesByName, renderTagOverride, selectedValue]);

  const handleChange = (option: {value: string | number} | undefined) => {
    if (!option) {
      return;
    }
    const field = String(option.value);
    onChange(
      fieldValuesByName.get(field)?.value.kind === FieldValueKind.NUMERIC_METRICS
        ? {kind: 'calculatedField', field}
        : {kind: FieldValueKind.FIELD, field}
    );
  };

  return (
    <QueryFieldWrapper ref={ref} style={style}>
      {isDragging ? null : (
        <Fragment>
          {canDrag && <StyledDragReorderButton {...listeners} {...attributes} />}
          <FullWidthCompactSelect
            search
            options={options}
            value={selectedValue}
            onChange={handleChange}
            disabled={disabled}
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps}>
                {selectedValue ? triggerProps.children : t('Select group')}
              </OverlayTrigger.Button>
            )}
          />
          {fieldValidationError ? fieldValidationError : null}
          {extraActions}
          {canDelete && (
            <Button
              size="zero"
              variant="transparent"
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

function renderTag(fieldValue: FieldValue) {
  const valueType =
    'dataType' in fieldValue.meta
      ? (fieldValue.meta.dataType as FieldValueType)
      : undefined;
  return (
    <TypeBadge
      label={fieldValue.meta.name}
      valueKind={fieldValue.kind}
      valueType={valueType}
      deprecatedFields={DEPRECATED_FIELDS}
    />
  );
}

const StyledDragReorderButton = styled(DragReorderButton)`
  height: ${p => p.theme.form.md.height};
`;

const FullWidthCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
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
