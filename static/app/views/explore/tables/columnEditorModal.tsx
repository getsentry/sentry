import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';

import {ColumnEditor} from '../components/columnEditor';
import {useDragNDropColumns} from '../hooks/useDragNDropColumns';

interface ColumnEditorModalProps extends ModalRenderProps {
  columns: string[];
  numberTags: TagCollection;
  onColumnsChange: (fields: string[]) => void;
  stringTags: TagCollection;
}

export function ColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
  numberTags,
  stringTags,
}: ColumnEditorModalProps) {
  const {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    swapColumnsAtIndex,
  } = useDragNDropColumns({columns});

  function handleApply() {
    onColumnsChange(editableColumns.map(({column}) => column).filter(defined));
    closeModal();
  }

  return (
    <Fragment>
      <Header closeButton data-test-id="editor-header">
        <h4>{t('Edit Columns')}</h4>
      </Header>
      <Body data-test-id="editor-body">
        <ColumnEditor
          columns={editableColumns}
          onColumnChange={updateColumnAtIndex}
          onColumnDelete={deleteColumnAtIndex}
          onColumnSwap={swapColumnsAtIndex}
          stringTags={stringTags}
          numberTags={numberTags}
        />
        <AddColumnContainer>
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
        </AddColumnContainer>
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
  );
}

const AddColumnContainer = styled('div')`
  display: flex;
  flex-direction: row;
  margin-top: ${space(1)};
`;
