import {Fragment, useMemo, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {buildAttributeOptions} from 'sentry/views/explore/components/attributeOption';
import {
  DASHBOARD_ONLY_SPAN_ATTRIBUTES,
  EXPLORE_FIVE_MIN_STALE_TIME,
} from 'sentry/views/explore/constants';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  sortKnownAttributes,
  sortSearchedAttributes,
} from 'sentry/views/explore/utils/sortSearchedAttributes';

interface ColumnEditorModalProps extends ModalRenderProps {
  booleanTags: TagCollection;
  columns: readonly string[];
  numberTags: TagCollection;
  onColumnsChange: (columns: string[]) => void;
  stringTags: TagCollection;
  handleReset?: () => void;
  hiddenKeys?: string[];
  isDocsButtonHidden?: boolean;
  requiredTags?: string[];
  traceItemType?: TraceItemDataset;
}

export function ColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
  requiredTags,
  booleanTags,
  numberTags,
  stringTags,
  hiddenKeys,
  isDocsButtonHidden = false,
  handleReset,
  traceItemType = TraceItemDataset.SPANS,
}: ColumnEditorModalProps) {
  const tags = useMemo(
    () =>
      buildColumnOptions({
        columns,
        stringTags,
        numberTags,
        booleanTags,
        hiddenKeys,
        traceItemType,
      }),
    [booleanTags, columns, hiddenKeys, numberTags, stringTags, traceItemType]
  );

  // We keep a temporary state for the columns so that we can apply the changes
  // only when the user clicks on the apply button.
  const [tempColumns, setTempColumns] = useState(columns.slice());

  function handleApply() {
    onColumnsChange(tempColumns.filter(Boolean));
    closeModal();
  }

  return (
    <DragNDropContext columns={tempColumns} setColumns={setTempColumns}>
      {({insertColumn, updateColumnAtIndex, deleteColumnAtIndex, editableColumns}) => (
        <Fragment>
          <Header closeButton data-test-id="editor-header">
            <h4>{t('Edit Table')}</h4>
          </Header>
          <Body data-test-id="editor-body">
            {editableColumns.map((column, i) => {
              return (
                <ColumnEditorRow
                  key={column.uniqueId}
                  canDelete={editableColumns.length > 1}
                  required={requiredTags?.includes(column.column)}
                  column={column}
                  baseOptions={tags}
                  hiddenKeys={hiddenKeys}
                  traceItemType={traceItemType}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
                />
              );
            })}
            <RowContainer>
              <Grid flow="column" align="center" gap="md">
                <Button
                  size="sm"
                  aria-label={t('Add a Column')}
                  onClick={() => insertColumn('')}
                  icon={<IconAdd />}
                >
                  {t('Add a Column')}
                </Button>
              </Grid>
            </RowContainer>
          </Body>
          <Footer data-test-id="editor-footer">
            <Grid flow="column" align="center" gap="md">
              {!isDocsButtonHidden && (
                <LinkButton variant="secondary" href={SPAN_PROPS_DOCS_URL} external>
                  {t('Read the Docs')}
                </LinkButton>
              )}
              {handleReset ? (
                <Button
                  aria-label={t('Reset')}
                  onClick={() => {
                    handleReset();
                    closeModal();
                  }}
                >
                  {t('Reset')}
                </Button>
              ) : null}
              <Button aria-label={t('Apply')} variant="primary" onClick={handleApply}>
                {t('Apply')}
              </Button>
            </Grid>
          </Footer>
        </Fragment>
      )}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  baseOptions: Array<SelectOption<string>>;
  canDelete: boolean;
  column: Column<string>;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  traceItemType: TraceItemDataset;
  hiddenKeys?: string[];
  required?: boolean;
}

function ColumnEditorRow({
  canDelete,
  column,
  required,
  baseOptions,
  hiddenKeys,
  traceItemType,
  onColumnChange,
  onColumnDelete,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const hasSearch = debouncedSearch.length > 0;

  // The parent's tag collections come pre-filtered: useSpanItemAttributes folds in
  // DASHBOARD_ONLY_SPAN_ATTRIBUTES, and log callers pass HiddenColumnEditorLogFields
  // via hiddenKeys. The bare useTraceItemDatasetAttributes does neither, so merge
  // both here to keep the searched results consistent with baseOptions.
  const searchHiddenKeys = useMemo(() => {
    const merged = [...(hiddenKeys ?? [])];
    if (traceItemType === TraceItemDataset.SPANS) {
      merged.push(...DASHBOARD_ONLY_SPAN_ATTRIBUTES);
    }
    return merged;
  }, [hiddenKeys, traceItemType]);

  const {attributes: searchedStringTags, isLoading: stringLoading} =
    useTraceItemDatasetAttributes(
      traceItemType,
      {
        search: debouncedSearch,
        enabled: hasSearch,
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'string',
      searchHiddenKeys
    );
  const {attributes: searchedNumberTags, isLoading: numberLoading} =
    useTraceItemDatasetAttributes(
      traceItemType,
      {
        search: debouncedSearch,
        enabled: hasSearch,
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'number',
      searchHiddenKeys
    );
  const {attributes: searchedBooleanTags, isLoading: booleanLoading} =
    useTraceItemDatasetAttributes(
      traceItemType,
      {
        search: debouncedSearch,
        enabled: hasSearch,
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      },
      'boolean',
      searchHiddenKeys
    );

  const isSearchLoading = hasSearch && (stringLoading || numberLoading || booleanLoading);

  // Feed CompactSelect the full base list at all times so its built-in matcher
  // can filter synchronously while typing. Once the debounced server search
  // returns, merge in any attributes baseOptions doesn't already cover so the
  // user can still pick keys that weren't in the initial fetch.
  const options = useMemo(() => {
    if (!hasSearch) return baseOptions;
    const searched = buildColumnOptions({
      columns: [],
      stringTags: searchedStringTags,
      numberTags: searchedNumberTags,
      booleanTags: searchedBooleanTags,
      hiddenKeys,
      traceItemType,
    });
    if (searched.length === 0) return baseOptions;
    const baseValues = new Set(baseOptions.map(o => o.value));
    const additions = searched.filter(o => !baseValues.has(o.value));
    if (additions.length === 0) return baseOptions;
    return [...baseOptions, ...additions];
  }, [
    hasSearch,
    baseOptions,
    searchedStringTags,
    searchedNumberTags,
    searchedBooleanTags,
    hiddenKeys,
    traceItemType,
  ]);

  function handleColumnChange(option: SelectOption<SelectKey>) {
    if (defined(option) && typeof option.value === 'string') {
      onColumnChange(option.value);
    }
  }

  // The compact select component uses the option label to render the current
  // selection. This overrides it to render in a trailing item showing the type.
  const label = useMemo(() => {
    if (defined(column.column)) {
      const tag =
        options.find(option => option.value === column.column) ??
        baseOptions.find(option => option.value === column.column);
      if (defined(tag)) {
        return (
          <TriggerLabel>
            <TriggerLabelText>{tag.label}</TriggerLabelText>
            {tag.trailingItems &&
              (typeof tag.trailingItems === 'function'
                ? tag.trailingItems({
                    disabled: false,
                    isFocused: false,
                    isSelected: false,
                  })
                : tag.trailingItems)}
          </TriggerLabel>
        );
      }
    }
    return <TriggerLabel>{column.column || t('\u2014')}</TriggerLabel>;
  }, [column.column, options, baseOptions]);

  return (
    <RowContainer
      key={column.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      <StyledDragReorderButton size="sm" iconSize="sm" {...listeners} />
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        value={column.column ?? ''}
        onChange={handleColumnChange}
        disabled={required}
        search={{
          onChange: setSearch,
          filter: (option, searchText) => {
            return sortSearchedAttributes({
              fieldDefinitionType: traceItemType,
              option,
              searchText,
            });
          },
        }}
        loading={isSearchLoading}
        emptyMessage={isSearchLoading ? t('Loading\u2026') : t('No matching attributes')}
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            prefix={t('Column')}
            style={{
              width: '100%',
            }}
          >
            {label}
          </OverlayTrigger.Button>
        )}
      />
      <StyledButton
        aria-label={t('Remove Column')}
        variant="transparent"
        disabled={!canDelete || required}
        size="sm"
        icon={<IconDelete size="sm" />}
        onClick={onColumnDelete}
      />
    </RowContainer>
  );
}

interface BuildColumnOptionsParams {
  booleanTags: TagCollection;
  columns: readonly string[];
  numberTags: TagCollection;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
  hiddenKeys?: string[];
}

function buildColumnOptions({
  columns,
  stringTags,
  numberTags,
  booleanTags,
  hiddenKeys,
  traceItemType,
}: BuildColumnOptionsParams) {
  return buildAttributeOptions({
    numberTags,
    stringTags,
    booleanTags,
    traceItemType,
    extraColumns: columns,
  })
    .filter(option => {
      const hidden = hiddenKeys ?? [];
      if (hidden.includes(option.value)) return false;
      if (typeof option.label === 'string' && hidden.includes(option.label)) return false;
      return true;
    })
    .toSorted((a, b) => sortKnownAttributes(a, b, traceItemType));
}

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${p => p.theme.space.md};

  :not(:first-child) {
    margin-top: ${p => p.theme.space.md};
  }
`;

const StyledDragReorderButton = styled(DragReorderButton)`
  padding-left: 0;
  padding-right: 0;
`;

const StyledButton = styled(Button)`
  padding-left: 0;
  padding-right: 0;
`;

const StyledCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  text-align: left;
  line-height: 20px;
  display: flex;
  justify-content: space-between;
  flex: 1 1;
  min-width: 0;
`;

const TriggerLabelText = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
