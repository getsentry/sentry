import {useMemo} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  useExploreGroupBys,
  useExploreMode,
  useSetExploreGroupBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

import {DragNDropContext} from '../contexts/dragNDropContext';
import {useSpanTags} from '../contexts/spanTagsContext';
import type {Column} from '../hooks/useDragNDropColumns';

import {
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarGroupByProps {
  disabled?: boolean;
}

export function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  const tags = useSpanTags();
  const mode = useExploreMode();

  const groupBys = useExploreGroupBys();
  const setGroupBys = useSetExploreGroupBys();

  const disabledOptions: Array<SelectOption<string>> = useMemo(() => {
    return [
      {
        label: <Disabled>{t('Samples not grouped')}</Disabled>,
        value: UNGROUPED,
        textValue: t('none'),
      },
    ];
  }, []);

  const enabledOptions: Array<SelectOption<string>> = useMemo(() => {
    const potentialOptions = [
      // We do not support grouping by span id, we have a dedicated sample mode for that
      ...Object.keys(tags).filter(key => key !== 'id'),

      // These options aren't known to exist on this project but it was inserted into
      // the group bys somehow so it should be a valid options in the group bys.
      //
      // One place this may come from is when switching projects/environment/date range,
      // a tag may disappear based on the selection.
      ...groupBys.filter(groupBy => groupBy && !tags.hasOwnProperty(groupBy)),
    ];
    potentialOptions.sort();

    return [
      // hard code in an empty option
      {
        label: <Disabled>{t('None')}</Disabled>,
        value: UNGROUPED,
        textValue: t('none'),
      },
      ...potentialOptions.map(key => ({
        label: key,
        value: key,
        textValue: key,
      })),
    ];
  }, [groupBys, tags]);

  return (
    <DragNDropContext columns={groupBys} setColumns={setGroupBys}>
      {({editableColumns, insertColumn, updateColumnAtIndex, deleteColumnAtIndex}) => {
        return (
          <ToolbarSection data-test-id="section-group-by">
            <ToolbarHeader>
              <Tooltip
                position="right"
                title={t(
                  'Aggregated data by a key attribute to calculate averages, percentiles, count and more'
                )}
              >
                <ToolbarLabel disabled={disabled}>{t('Group By')}</ToolbarLabel>
              </Tooltip>
              <Tooltip title={t('Add a new group')}>
                <ToolbarHeaderButton
                  disabled={disabled}
                  size="zero"
                  onClick={insertColumn}
                  borderless
                  aria-label={t('Add Group')}
                  icon={<IconAdd />}
                />
              </Tooltip>
            </ToolbarHeader>
            {disabled ? (
              <ColumnEditorRow
                disabled={mode === Mode.SAMPLES}
                canDelete={false}
                column={{id: 1, column: ''}}
                options={disabledOptions}
                onColumnChange={() => {}}
                onColumnDelete={() => {}}
              />
            ) : (
              editableColumns.map((column, i) => (
                <ColumnEditorRow
                  disabled={mode === Mode.SAMPLES}
                  key={column.id}
                  canDelete={
                    editableColumns.length > 1 || !['', undefined].includes(column.column)
                  }
                  column={column}
                  options={enabledOptions}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
                />
              ))
            )}
          </ToolbarSection>
        );
      }}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  canDelete: boolean;
  column: Column;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
  disabled?: boolean;
}

function ColumnEditorRow({
  canDelete,
  column,
  options,
  onColumnChange,
  onColumnDelete,
  disabled = false,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  function handleColumnChange(option: SelectOption<SelectKey>) {
    if (defined(option) && typeof option.value === 'string') {
      onColumnChange(option.value);
    }
  }

  const label = useMemo(() => {
    const tag = options.find(option => option.value === column.column);
    return <TriggerLabel>{tag?.label ?? t('None')}</TriggerLabel>;
  }, [column.column, options]);

  return (
    <ToolbarRow
      key={column.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      <Button
        aria-label={t('Drag to reorder')}
        borderless
        size="zero"
        disabled={disabled}
        icon={<IconGrabbable size="sm" />}
        {...listeners}
      />
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        triggerLabel={label}
        disabled={disabled}
        value={column.column ?? ''}
        onChange={handleColumnChange}
        searchable
        triggerProps={{
          style: {
            width: '100%',
          },
        }}
      />
      <Button
        aria-label={t('Remove Column')}
        borderless
        disabled={!canDelete || disabled}
        size="zero"
        icon={<IconDelete size="sm" />}
        onClick={() => onColumnDelete()}
      />
    </ToolbarRow>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  flex-grow: 1;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
  line-height: normal;
  position: relative;
  font-weight: normal;
`;

const Disabled = styled('span')`
  color: ${p => p.theme.gray300};
`;
