import {useMemo} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
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
}: ToolbarGroupByDropdownProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
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
      style={{transform: CSS.Transform.toString(transform), transition}}
      {...attributes}
    >
      {canDelete ? (
        <Button
          aria-label={t('Drag to reorder')}
          borderless
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
        searchable
        triggerProps={{children: label, style: {width: '100%'}}}
        menuTitle="Group By"
        onSearch={onSearch}
        onClose={onClose}
        loading={loading}
      />
      {canDelete ? (
        <Button
          aria-label={t('Remove Column')}
          borderless
          size="zero"
          icon={<IconDelete size="sm" />}
          onClick={() => onColumnDelete()}
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
      borderless
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
