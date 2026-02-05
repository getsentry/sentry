import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Switch} from '@sentry/scraps/switch';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSetQueryParamsSavedQuery} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

export type SaveQueryModalProps = {
  organization: Organization;
  saveQuery: (name: string, starred?: boolean) => Promise<SavedQuery>;
  traceItemDataset: TraceItemDataset;
  name?: string;
  source?: 'toolbar' | 'table';
};

type Props = ModalRenderProps & SaveQueryModalProps;

function SaveQueryModal({
  Header,
  Body,
  Footer,
  closeModal,
  saveQuery,
  name: initialName,
  source,
  traceItemDataset,
}: Props) {
  const organization = useOrganization();

  const [name, setName] = useState(initialName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [starred, setStarred] = useState(true);

  const setQueryParamsSavedQuery = useSetQueryParamsSavedQuery();

  const onSave = useCallback(async () => {
    try {
      setIsSaving(true);
      addLoadingMessage(t('Saving query...'));
      const {id} = await saveQuery(name, initialName === undefined ? starred : undefined);
      if (initialName === undefined) {
        setQueryParamsSavedQuery(id, name);
      }
      addSuccessMessage(t('Query saved successfully'));
      if (defined(source)) {
        if (traceItemDataset === TraceItemDataset.LOGS) {
          trackAnalytics('logs.save_query_modal', {
            action: 'submit',
            save_type: initialName === undefined ? 'save_new_query' : 'rename_query',
            ui_source: source,
            organization,
          });
        } else if (traceItemDataset === TraceItemDataset.SPANS) {
          trackAnalytics('trace_explorer.save_query_modal', {
            action: 'submit',
            save_type: initialName === undefined ? 'save_new_query' : 'rename_query',
            ui_source: source,
            organization,
          });
        }
      }
      closeModal();
    } catch (error) {
      addErrorMessage(t('Failed to save query'));
      Sentry.captureException(error);
    } finally {
      setIsSaving(false);
    }
  }, [
    saveQuery,
    name,
    starred,
    setQueryParamsSavedQuery,
    closeModal,
    organization,
    initialName,
    source,
    traceItemDataset,
  ]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{defined(initialName) ? t('Rename Query') : t('New Query')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <SectionHeader>{t('Name')}</SectionHeader>
          <Input
            placeholder={
              defined(initialName)
                ? t('Enter a name for your query')
                : t('Enter a name for your new query')
            }
            onChange={e => setName(e.target.value)}
            value={name}
            title={
              defined(initialName)
                ? t('Enter a name for your query')
                : t('Enter a name for your new query')
            }
          />
        </Wrapper>
        {initialName === undefined && (
          <StarredWrapper>
            <Switch
              checked={starred}
              onChange={() => {
                setStarred(!starred);
              }}
              title={t('Starred')}
            />
            <SectionHeader>{t('Starred')}</SectionHeader>
          </StarredWrapper>
        )}
      </Body>

      <Footer>
        <StyledButtonBar gap="lg">
          <Button onClick={closeModal} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSave} disabled={!name || isSaving} priority="primary">
            {defined(initialName) ? t('Save Changes') : t('Create a New Query')}
          </Button>
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export default SaveQueryModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StarredWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;

  > h6 {
    margin-bottom: 0;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

const SectionHeader = styled('h6')`
  font-size: ${p => p.theme.form.md.fontSize};
  margin-bottom: ${space(0.5)};
`;
