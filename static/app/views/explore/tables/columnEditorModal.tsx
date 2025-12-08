import {Fragment, useMemo, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {classifyTagKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface ColumnEditorModalProps extends ModalRenderProps {
  columns: readonly string[];
  numberTags: TagCollection;
  onColumnsChange: (columns: string[]) => void;
  stringTags: TagCollection;
  handleReset?: () => void;
  hiddenKeys?: string[];
  isDocsButtonHidden?: boolean;
  requiredTags?: string[];
}

export function ColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
  requiredTags,
  numberTags,
  stringTags,
  hiddenKeys,
  isDocsButtonHidden = false,
  handleReset,
}: ColumnEditorModalProps) {
  const tags: Array<SelectOption<string>> = useMemo(() => {
    let allTags = [
      ...columns
        .filter(column => !(column in stringTags) && !(column in numberTags))
        .map(column => {
          const kind = classifyTagKey(column);
          const label = prettifyTagKey(column);
          return {
            label,
            value: column,
            textValue: column,
            trailingItems: <TypeBadge kind={kind} />,
            key: `${column}-${classifyTagKey(column)}`,
            showDetailsInOverlay: true,
            details: (
              <AttributeDetails
                column={column}
                kind={kind}
                label={label}
                traceItemType={TraceItemDataset.SPANS}
              />
            ),
          };
        }),
      ...Object.values(stringTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge kind={FieldKind.TAG} />,
          key: `${tag.key}-${FieldKind.TAG}`,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={tag.key}
              kind={FieldKind.TAG}
              label={tag.name}
              traceItemType={TraceItemDataset.SPANS}
            />
          ),
        };
      }),
      ...Object.values(numberTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge kind={FieldKind.MEASUREMENT} />,
          key: `${tag.key}-${FieldKind.MEASUREMENT}`,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={tag.key}
              kind={FieldKind.TAG}
              label={tag.name}
              traceItemType={TraceItemDataset.SPANS}
            />
          ),
        };
      }),
    ];
    allTags = allTags
      .filter(tag => !(hiddenKeys ?? []).includes(tag.label))
      .toSorted((a, b) => {
        if (a.label < b.label) {
          return -1;
        }

        if (a.label > b.label) {
          return 1;
        }

        return 0;
      });
    return allTags;
  }, [columns, stringTags, numberTags, hiddenKeys]);

  // We keep a temporary state for the columns so that we can apply the changes
  // only when the user clicks on the apply button.
  const [tempColumns, setTempColumns] = useState<string[]>(columns.slice());

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
                  key={column.id}
                  canDelete={editableColumns.length > 1}
                  required={requiredTags?.includes(column.column)}
                  column={column}
                  options={tags}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
                />
              );
            })}
            <RowContainer>
              <ButtonBar>
                <Button
                  size="sm"
                  aria-label={t('Add a Column')}
                  onClick={() => insertColumn('')}
                  icon={<IconAdd />}
                >
                  {t('Add a Column')}
                </Button>
              </ButtonBar>
            </RowContainer>
          </Body>
          <Footer data-test-id="editor-footer">
            <ButtonBar>
              {!isDocsButtonHidden && (
                <LinkButton priority="default" href={SPAN_PROPS_DOCS_URL} external>
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
              <Button aria-label={t('Apply')} priority="primary" onClick={handleApply}>
                {t('Apply')}
              </Button>
            </ButtonBar>
          </Footer>
        </Fragment>
      )}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  canDelete: boolean;
  column: Column<string>;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
  required?: boolean;
}

function ColumnEditorRow({
  canDelete,
  column,
  required,
  options,
  onColumnChange,
  onColumnDelete,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  function handleColumnChange(option: SelectOption<SelectKey>) {
    if (defined(option) && typeof option.value === 'string') {
      onColumnChange(option.value);
    }
  }

  // The compact select component uses the option label to render the current
  // selection. This overrides it to render in a trailing item showing the type.
  const label = useMemo(() => {
    if (defined(column.column)) {
      const tag = options.find(option => option.value === column.column);
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
  }, [column.column, options]);

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
      <StyledButton
        aria-label={t('Drag to reorder')}
        borderless
        size="sm"
        icon={<IconGrabbable size="sm" />}
        {...listeners}
      />
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        value={column.column ?? ''}
        onChange={handleColumnChange}
        disabled={required}
        searchable
        triggerProps={{
          children: label,
          prefix: t('Column'),
          style: {
            width: '100%',
          },
        }}
      />
      <StyledButton
        aria-label={t('Remove Column')}
        borderless
        disabled={!canDelete || required}
        size="sm"
        icon={<IconDelete size="sm" />}
        onClick={onColumnDelete}
      />
    </RowContainer>
  );
}

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};

  :not(:first-child) {
    margin-top: ${space(1)};
  }
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
  ${p => p.theme.overflowEllipsis}
`;
