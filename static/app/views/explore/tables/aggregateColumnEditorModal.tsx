import {Fragment, useCallback, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {
  AggregateField,
  BaseAggregateField,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';

interface AggregateColumnEditorModalProps extends ModalRenderProps {
  columns: AggregateField[];
  numberTags: TagCollection;
  onColumnsChange: (columns: BaseAggregateField[]) => void;
  stringTags: TagCollection;
}

export function AggregateColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
}: AggregateColumnEditorModalProps) {
  // We keep a temporary state for the columns so that we can apply the changes
  // only when the user clicks on the apply button.
  const [tempColumns, setTempColumns] = useState<AggregateField[]>(columns);

  const handleApply = useCallback(() => {
    onColumnsChange(tempColumns);
    closeModal();
  }, [closeModal, onColumnsChange, tempColumns]);

  return (
    <DragNDropContext
      columns={tempColumns}
      setColumns={setTempColumns}
      defaultColumn={() => ({groupBy: ''})}
    >
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
                  column={column}
                  options={[]}
                  onColumnChange={c => updateColumnAtIndex(i, c)}
                  onColumnDelete={() => deleteColumnAtIndex(i)}
                />
              );
            })}
            <RowContainer>
              <ButtonBar gap={1}>
                <Button
                  size="sm"
                  aria-label={t('Add a Column')}
                  onClick={insertColumn}
                  icon={<IconAdd isCircled />}
                >
                  {t('Add a Column')}
                </Button>
              </ButtonBar>
            </RowContainer>
          </Body>
          <Footer data-test-id="editor-footer">
            <ButtonBar gap={1}>
              <LinkButton priority="default" href={SPAN_PROPS_DOCS_URL} external>
                {t('Read the Docs')}
              </LinkButton>
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
  column: Column<AggregateField>;
  onColumnChange: (column: AggregateField) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
}

function ColumnEditorRow({canDelete, column, onColumnDelete}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

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
      {JSON.stringify(column.column)}
      <StyledButton
        aria-label={t('Remove Column')}
        borderless
        disabled={!canDelete}
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
