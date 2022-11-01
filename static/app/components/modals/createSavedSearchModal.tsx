import {useState} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {createSavedSearch} from 'sentry/actionCreators/savedSearches';
import Alert from 'sentry/components/alert';
import {Form, SelectField, TextField} from 'sentry/components/forms';
import {OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

type Props = ModalRenderProps & {
  organization: Organization;
  query: string;
  sort?: string;
};

const DEFAULT_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.PRIORITY,
  IssueSortOptions.USER,
];

function CreateSavedSearchModal({
  Header,
  Body,
  closeModal,
  organization,
  query,
  sort,
}: Props) {
  const api = useApi();
  const [error, setError] = useState(null);

  const sortOptions = organization?.features?.includes('issue-list-trend-sort')
    ? [...DEFAULT_SORT_OPTIONS, IssueSortOptions.TREND]
    : DEFAULT_SORT_OPTIONS;

  const validateSortOption = (unvalidatedSort?: string | null): string => {
    if (sortOptions.find(option => option === unvalidatedSort)) {
      return unvalidatedSort as string;
    }

    return IssueSortOptions.DATE;
  };

  const selectFieldSortOptions = sortOptions.map(sortOption => ({
    value: sortOption,
    label: getSortLabel(sortOption),
  }));

  const initialData = {
    name: '',
    query,
    sort: validateSortOption(sort),
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
      await createSavedSearch(
        api,
        organization.slug,
        data.name,
        data.query,
        validateSortOption(data.sort)
      );

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
        <h4>{t('Save Current Search')}</h4>
      </Header>

      <Body>
        {error && <Alert type="error">{error}</Alert>}

        <p>{t('All team members will now have access to this search.')}</p>
        <TextField
          key="name"
          name="name"
          label={t('Name')}
          placeholder="e.g. My Search Results"
          inline={false}
          stacked
          flexibleControlStateSize
          required
        />
        <TextField
          key="query"
          name="query"
          label={t('Query')}
          inline={false}
          stacked
          flexibleControlStateSize
          required
        />
        <SelectField
          key="sort"
          name="sort"
          label={t('Sort By')}
          options={selectFieldSortOptions}
          required
          clearable={false}
          inline={false}
          stacked
          flexibleControlStateSize
        />
      </Body>
    </Form>
  );
}

export default CreateSavedSearchModal;
