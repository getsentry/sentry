import {Fragment} from 'react';

import {SelectField, TextField} from 'sentry/components/forms';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {Organization, SavedSearchVisibility} from 'sentry/types';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

type SavedSearchModalContentProps = {
  organization: Organization;
};

const DEFAULT_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.PRIORITY,
  IssueSortOptions.USER,
];

const SELECT_FIELD_VISIBILITY_OPTIONS = [
  {value: SavedSearchVisibility.Owner, label: t('Only me')},
  {value: SavedSearchVisibility.Organization, label: t('Users in my organization')},
];

function getSortOptions(organization: Organization) {
  return organization?.features?.includes('issue-list-trend-sort')
    ? [...DEFAULT_SORT_OPTIONS, IssueSortOptions.TREND]
    : DEFAULT_SORT_OPTIONS;
}

export function SavedSearchModalContent({organization}: SavedSearchModalContentProps) {
  const canChangeVisibility = organization.access.includes('org:write');

  const selectFieldSortOptions = getSortOptions(organization).map(sortOption => ({
    value: sortOption,
    label: getSortLabel(sortOption),
  }));

  return (
    <Fragment>
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
        {({id, name, onChange, onBlur, disabled, value}) => (
          <IssueListSearchBar
            id={id}
            name={name}
            organization={organization}
            onClose={newValue => {
              onChange(newValue, {});
              onBlur(newValue, {});
            }}
            includeLabel={false}
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
          disabledReason={t('Only organization admins can create global saved searches.')}
          name="visibility"
          label={t('Choose who can view this saved search')}
          options={SELECT_FIELD_VISIBILITY_OPTIONS}
          required
          clearable={false}
          inline={false}
          stacked
          flexibleControlStateSize
        />
      )}
    </Fragment>
  );
}
