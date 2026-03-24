import {useMemo} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {getFieldDefinition} from 'sentry/utils/fields';
import {
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
} from 'sentry/views/explore/components/toolbar/styles';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';

export function ToolbarGroupByHeader() {
  return (
    <ToolbarHeader>
      <Tooltip
        position="right"
        title={t(
          'Aggregated data by a key attribute to calculate averages, percentiles, count and more'
        )}
      >
        <ToolbarLabel>{t('Group By')}</ToolbarLabel>
      </Tooltip>
    </ToolbarHeader>
  );
}

interface ToolbarGroupByDropdownProps {
  canDelete: boolean;
  column: Column<string>;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
  fieldDefinitionType?: Parameters<typeof getFieldDefinition>[1];
  loading?: boolean;
  onClose?: () => void;
  onSearch?: (search: string) => void;
}

export function ToolbarGroupByDropdown({
  canDelete,
  column,
  onColumnChange,
  onColumnDelete,
  options,
  onSearch,
  loading,
  onClose,
  fieldDefinitionType = 'span',
}: ToolbarGroupByDropdownProps) {
  const {attributes, listeners, setNodeRef, transform} = useSortable({
    id: column.id,
    transition: null,
  });

  function handleColumnChange(option: SelectOption<SelectKey>) {
    if (typeof option.value === 'string') {
      onColumnChange(option.value);
    }
  }

  const label = useMemo(() => {
    const tag = options.find(option => option.value === column.column);
    return <TriggerLabel>{tag?.label ?? column.column}</TriggerLabel>;
  }, [column.column, options]);

  return (
    <ToolbarRow
      key={column.id}
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform)}}
      {...attributes}
    >
      {canDelete ? (
        <Button
          aria-label={t('Drag to reorder')}
          priority="transparent"
          size="zero"
          icon={<IconGrabbable size="sm" />}
          {...listeners}
        />
      ) : null}
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        value={column.column ?? ''}
        onChange={handleColumnChange}
        search={{
          onChange: onSearch,
          filter: (option, search) => {
            const text =
              option.textValue ?? (typeof option.label === 'string' ? option.label : '');
            const normalizedText = text.toLowerCase();
            const normalizedSearch = search.toLowerCase();
            if (!normalizedText.includes(normalizedSearch)) {
              return {score: 0};
            }
            const isExact = normalizedText === normalizedSearch;
            const isKnown =
              getFieldDefinition(String(option.value), fieldDefinitionType) !== null;
            // exact+known=4, exact+unknown=3, partial+known=2, partial+unknown=1
            return {score: (isExact ? 2 : 0) + (isKnown ? 2 : 1)};
          },
        }}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} style={{width: '100%'}}>
            {label}
          </OverlayTrigger.Button>
        )}
        menuTitle="Group By"
        onClose={onClose}
        loading={loading}
      />
      {canDelete ? (
        <Button
          aria-label={t('Remove Column')}
          priority="transparent"
          size="zero"
          icon={<IconDelete size="sm" />}
          onClick={() => onColumnDelete()}
        />
      ) : column.column ? (
        <Button
          aria-label={t('Clear Group By')}
          priority="transparent"
          size="zero"
          icon={<IconDelete size="sm" />}
          onClick={() => onColumnChange('')}
        />
      ) : null}
    </ToolbarRow>
  );
}

interface ToolbarVisualizeAddProps {
  add: () => void;
  disabled: boolean;
}

export function ToolbarGroupByAddGroupBy({add, disabled}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
      size="zero"
      icon={<IconAdd />}
      onClick={add}
      priority="link"
      aria-label={t('Add Group')}
      disabled={disabled}
    >
      {t('Add Group')}
    </ToolbarFooterButton>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  flex-grow: 1;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  line-height: normal;
  position: relative;
  font-weight: normal;
`;
