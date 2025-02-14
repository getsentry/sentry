import {useState} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {SavedSearchModalContent} from 'sentry/components/modals/savedSearchModal/savedSearchModalContent';
import {t} from 'sentry/locale';
import type {SavedSearch} from 'sentry/types/group';
import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {useModifySavedSearch} from 'sentry/views/issueList/mutations/useModifySavedSearch';

interface EditSavedSearchModalProps extends ModalRenderProps {
  organization: Organization;
  savedSearch: SavedSearch;
}

export function EditSavedSearchModal({
  Header,
  Body,
  closeModal,
  organization,
  savedSearch,
}: EditSavedSearchModalProps) {
  const [error, setError] = useState(null);

  const {mutateAsync: modifySavedSearch} = useModifySavedSearch();

  const initialData = {
    name: savedSearch.name,
    query: savedSearch.query,
    sort: savedSearch.sort,
    visibility: savedSearch.visibility,
  };

  const handleSubmit: OnSubmitCallback = async (
    data,
    onSubmitSuccess,
    onSubmitError,
    event
  ) => {
    event.preventDefault();
    setError(null);

    addLoadingMessage(t('Saving Changes'));

    try {
      await modifySavedSearch({
        id: savedSearch.id,
        orgSlug: organization.slug,
        name: data.name,
        query: data.query,
        sort: data.sort,
        type: SavedSearchType.ISSUE,
        visibility: data.visibility,
      });

      closeModal();
      clearIndicators();
      onSubmitSuccess(data);
    } catch (err) {
      clearIndicators();
      onSubmitError(
        err?.responseJSON?.detail
          ? err.responseJSON.detail
          : t('Unable to save your changes.')
      );
    }
  };

  return (
    <Form
      onSubmit={handleSubmit}
      onCancel={closeModal}
      saveOnBlur={false}
      initialData={initialData}
      submitLabel={t('Save')}
      onSubmitError={submitError => setError(submitError)}
    >
      <Header>
        <h4>{t('Edit Saved Search')}</h4>
      </Header>

      <Body>
        {error && (
          <Alert.Container>
            <Alert type="error">{error}</Alert>
          </Alert.Container>
        )}
        <SavedSearchModalContent {...{organization}} />
      </Body>
    </Form>
  );
}
