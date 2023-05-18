import {useState} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Form} from 'sentry/components/forms';
import {OnSubmitCallback} from 'sentry/components/forms/types';
import {SavedSearchModalContent} from 'sentry/components/modals/savedSearchModal/savedSearchModalContent';
import {t} from 'sentry/locale';
import {Organization, SavedSearchType, SavedSearchVisibility} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCreateSavedSearch} from 'sentry/views/issueList/mutations/useCreateSavedSearch';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

interface CreateSavedSearchModalProps extends ModalRenderProps {
  organization: Organization;
  query: string;
  sort?: string;
}

const DEFAULT_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.PRIORITY,
  IssueSortOptions.USER,
];

function validateSortOption({sort}: {sort?: string}) {
  if (DEFAULT_SORT_OPTIONS.find(option => option === sort)) {
    return sort as string;
  }

  return IssueSortOptions.DATE;
}

export function CreateSavedSearchModal({
  Header,
  Body,
  closeModal,
  organization,
  query,
  sort,
}: CreateSavedSearchModalProps) {
  const [error, setError] = useState(null);

  const {mutateAsync: createSavedSearch} = useCreateSavedSearch();

  const initialData = {
    name: '',
    query,
    sort: validateSortOption({sort}),
    visibility: SavedSearchVisibility.Owner,
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

    trackAnalytics('search.saved_search_create', {
      name: data.name,
      organization,
      query: data.query,
      search_type: 'issues',
      sort: data.sort,
      visibility: data.visibility,
    });

    try {
      await createSavedSearch({
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
        <h4>{t('Create a Saved Search')}</h4>
      </Header>

      <Body>
        {error && <Alert type="error">{error}</Alert>}
        <SavedSearchModalContent organization={organization} />
      </Body>
    </Form>
  );
}
