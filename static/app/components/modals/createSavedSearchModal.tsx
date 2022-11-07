import {useState} from 'react';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {createSavedSearch} from 'sentry/actionCreators/savedSearches';
import Alert from 'sentry/components/alert';
import {Form, SelectField, TextField} from 'sentry/components/forms';
import FormField from 'sentry/components/forms/formField';
import {OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {Organization, SavedSearchVisibility} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
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

  const selectFieldVisibilityOptions = [
    {value: SavedSearchVisibility.Owner, label: t('Only me')},
    {value: SavedSearchVisibility.Organization, label: t('Users in my organization')},
  ];

  const canChangeVisibility = organization.access.includes('org:write');

  const initialData = {
    name: '',
    query,
    sort: validateSortOption(sort),
    visibility: organization.features.includes('issue-list-saved-searches-v2')
      ? SavedSearchVisibility.Owner
      : SavedSearchVisibility.Organization,
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

    trackAdvancedAnalyticsEvent('search.saved_search_create', {
      name: data.name,
      organization,
      query: data.query,
      search_type: 'issues',
      sort: data.sort,
      visibility: data.visibility,
    });

    try {
      await createSavedSearch(
        api,
        organization.slug,
        data.name,
        data.query,
        validateSortOption(data.sort),
        data.visibility
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

        <TextField
          key="name"
          name="name"
          label={t('Add a name')}
          placeholder="e.g. My Search Results"
          inline={false}
          stacked
          flexibleControlStateSize
          required
        />
        <FormField
          key="query"
          name="query"
          label={t('Filter issues')}
          inline={false}
          stacked
          flexibleControlStateSize
          required
        >
          {({onChange, onBlur, disabled, value}) => (
            <IssueListSearchBar
              organization={organization}
              onClose={newValue => {
                onChange(newValue, {});
                onBlur(newValue, {});
              }}
              useFormWrapper={false}
              disabled={disabled}
              query={value}
            />
          )}
        </FormField>
        <SelectField
          key="sort"
          name="sort"
          label={t('Sort issues')}
          options={selectFieldSortOptions}
          required
          clearable={false}
          inline={false}
          stacked
          flexibleControlStateSize
        />
        {organization.features.includes('issue-list-saved-searches-v2') && (
          <SelectField
            disabled={!canChangeVisibility}
            disabledReason={t(
              'Only organization admins can create global saved searches.'
            )}
            name="visibility"
            label={t('Choose who can view this saved search')}
            options={selectFieldVisibilityOptions}
            required
            clearable={false}
            inline={false}
            stacked
            flexibleControlStateSize
          />
        )}
      </Body>
    </Form>
  );
}

export default CreateSavedSearchModal;
