import {Fragment, useState} from 'react';
import * as Sentry from '@sentry/react';
import {parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {type ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';

type SaveModalProps = ModalRenderProps & {
  onSave: (name: string, starred: boolean) => Promise<void>;
};

function SaveConversationQueryModal({
  Header,
  Body,
  Footer,
  closeModal,
  onSave,
}: SaveModalProps) {
  const [name, setName] = useState('');
  const [starred, setStarred] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    try {
      setIsSaving(true);
      addLoadingMessage(t('Saving query...'));
      await onSave(name, starred);
      addSuccessMessage(t('Query saved successfully'));
      closeModal();
    } catch (error) {
      addErrorMessage(t('Failed to save query'));
      Sentry.captureException(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('New Query')}</h4>
      </Header>
      <Body>
        <Container marginBottom="xl">
          <h6>{t('Name')}</h6>
          <Input
            autoFocus
            placeholder={t('Enter a name for your new query')}
            onChange={e => setName(e.target.value)}
            value={name}
            title={t('Enter a name for your new query')}
          />
        </Container>
        <Flex gap="md" align="center">
          <Switch
            checked={starred}
            onChange={() => setStarred(!starred)}
            title={t('Starred')}
          />
          <h6>{t('Starred')}</h6>
        </Flex>
      </Body>
      <Footer>
        <Flex gap="lg" align="center" justify="end">
          <Button onClick={closeModal} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name || isSaving} variant="primary">
            {t('Create a New Query')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

export function SaveConversationQueryButton() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const [searchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );

  function handleClick() {
    trackAnalytics('conversations.save_query_modal', {
      action: 'open',
      organization,
    });

    openModal(modalProps => (
      <SaveConversationQueryModal
        {...modalProps}
        onSave={async (name, starred) => {
          const {datetime, projects, environments} = selection;
          await api.requestPromise(`/organizations/${organization.slug}/explore/saved/`, {
            method: 'POST',
            data: {
              name,
              dataset: 'ai_conversations',
              projects,
              environment: environments,
              range: datetime.period ?? undefined,
              start: datetime.start ?? undefined,
              end: datetime.end ?? undefined,
              starred,
              query: [
                {
                  fields: [],
                  mode: Mode.SAMPLES,
                  query: searchQuery ?? '',
                },
              ],
            },
          });
          invalidateSavedQueries();

          trackAnalytics('conversations.save_query_modal', {
            action: 'submit',
            organization,
          });
        }}
      />
    ));
  }

  return (
    <Button variant="primary" onClick={handleClick} aria-label={t('Save as')}>
      {t('Save as')}
    </Button>
  );
}
