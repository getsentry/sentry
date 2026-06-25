import {Fragment, useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {
  ALL_CONVERSATION_COLUMNS,
  type ConversationColumnKey,
  CONVERSATION_COLUMNS,
  DEFAULT_CONVERSATION_COLUMNS,
  parseConversationColumns,
} from 'sentry/views/explore/conversations/utils/tableColumns';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';

interface ConversationsTableEditModalProps extends ModalRenderProps {
  columns: readonly ConversationColumnKey[];
  onColumnsChange: (columns: ConversationColumnKey[]) => void;
}

export function ConversationsTableEditModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
}: ConversationsTableEditModalProps) {
  const [tempColumns, setTempColumns] = useState(columns.slice());

  return (
    <DragNDropContext columns={tempColumns} setColumns={setTempColumns}>
      {({insertColumn, updateColumnAtIndex, deleteColumnAtIndex, editableColumns}) => {
        // Default the new row to the first column not already shown, falling back
        // to the first column so a duplicate is allowed once they're all in use.
        const usedColumns = new Set(editableColumns.map(c => c.column));
        const nextColumn: ConversationColumnKey =
          ALL_CONVERSATION_COLUMNS.find(key => !usedColumns.has(key)) ?? 'conversationId';

        return (
          <Fragment>
            <Header closeButton>
              <Heading as="h4">{t('Edit Table')}</Heading>
            </Header>
            <Body>
              <Stack gap="md">
                {editableColumns.map((column, i) => (
                  <ColumnEditorRow
                    key={column.uniqueId}
                    column={column}
                    canDelete={editableColumns.length > 1}
                    onColumnChange={value => updateColumnAtIndex(i, value)}
                    onColumnDelete={() => deleteColumnAtIndex(i)}
                  />
                ))}
                <Flex>
                  <Button
                    size="sm"
                    onClick={() => insertColumn(nextColumn)}
                    icon={<IconAdd />}
                  >
                    {t('Add a Column')}
                  </Button>
                </Flex>
              </Stack>
            </Body>
            <Footer>
              <Grid flow="column" align="center" gap="md">
                <Button onClick={() => setTempColumns([...DEFAULT_CONVERSATION_COLUMNS])}>
                  {t('Reset')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const parsedConversationColumns = parseConversationColumns(
                      editableColumns.map(c => c.column)
                    );
                    onColumnsChange(parsedConversationColumns);
                    closeModal();
                  }}
                >
                  {t('Apply')}
                </Button>
              </Grid>
            </Footer>
          </Fragment>
        );
      }}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  canDelete: boolean;
  column: Column<ConversationColumnKey>;
  onColumnChange: (column: ConversationColumnKey) => void;
  onColumnDelete: () => void;
}

function ColumnEditorRow({
  canDelete,
  column,
  onColumnChange,
  onColumnDelete,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  return (
    <Flex align="center" gap="md">
      {({className}) => (
        <div
          className={className}
          ref={setNodeRef}
          style={{transform: CSS.Transform.toString(transform), transition}}
          {...attributes}
        >
          <StyledDragReorderButton size="sm" iconSize="sm" {...listeners} />
          <CompactSelect
            options={ALL_CONVERSATION_COLUMNS.map(key => ({
              value: key,
              label: CONVERSATION_COLUMNS[key].name,
              trailingItems: <TypeBadge valueType={CONVERSATION_COLUMNS[key].type} />,
            }))}
            value={column.column}
            onChange={option => onColumnChange(option.value)}
            style={{flex: 1, minWidth: 0}}
            trigger={triggerProps => {
              const definition = CONVERSATION_COLUMNS[column.column];
              return (
                <OverlayTrigger.Button
                  {...triggerProps}
                  prefix={t('Column')}
                  style={{width: '100%'}}
                >
                  <Flex flex="1" align="center" justify="between" gap="xs" minWidth={0}>
                    <Text ellipsis align="left">
                      {definition.name}
                    </Text>
                    <TypeBadge valueType={definition.type} />
                  </Flex>
                </OverlayTrigger.Button>
              );
            }}
          />
          <StyledButton
            aria-label={t('Remove Column')}
            variant="transparent"
            disabled={!canDelete}
            size="sm"
            icon={<IconDelete size="sm" />}
            onClick={onColumnDelete}
          />
        </div>
      )}
    </Flex>
  );
}

const StyledDragReorderButton = styled(DragReorderButton)`
  padding-left: 0;
  padding-right: 0;
`;

const StyledButton = styled(Button)`
  padding-left: 0;
  padding-right: 0;
`;
