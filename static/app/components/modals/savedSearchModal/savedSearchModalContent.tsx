import {Fragment} from 'react';

import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {Organization, SavedSearchVisibility} from 'sentry/types';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

type SavedSearchModalContentProps = {
  organization: Organization;
};

const SELECT_FIELD_VISIBILITY_OPTIONS = [
  {value: SavedSearchVisibility.OWNER, label: t('Only me')},
  {value: SavedSearchVisibility.ORGANIZATION, label: t('Users in my organization')},
];

export function SavedSearchModalContent({organization}: SavedSearchModalContentProps) {
  const canChangeVisibility = organization.access.includes('org:write');

  const sortOptions = [
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    IssueSortOptions.PRIORITY,
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
  ];

  const selectFieldSortOptions = sortOptions.map(sortOption => ({
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
    </Fragment>
  );
}
