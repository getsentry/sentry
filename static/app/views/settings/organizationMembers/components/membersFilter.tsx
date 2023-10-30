import {SelectOption} from 'sentry/components/compactSelect';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {OrgRole} from 'sentry/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

type Props = {
  onChange: (query: string) => void;
  query: string;
  roles: OrgRole[];
};

type Filters = {
  has2fa: boolean | null;
  isInvited: boolean | null;
  roles: string[];
  ssoLinked: boolean | null;
};

const getBooleanValue = (list: string[]) => {
  if (!Array.isArray(list) || !list.length) {
    return 'all';
  }

  return list && list.map(v => v.toLowerCase()).includes('true') ? 'true' : 'false';
};

const booleanOptions = [
  {value: 'all', label: t('All')},
  {value: 'true', label: t('True')},
  {value: 'false', label: t('False')},
];

function MembersFilter({roles, query, onChange}: Props) {
  const search = new MutableSearch(query);

  const filters = {
    roles: search.getFilterValues('role') || [],
    isInvited: getBooleanValue(search.getFilterValues('isInvited')),
    ssoLinked: getBooleanValue(search.getFilterValues('ssoLinked')),
    has2fa: getBooleanValue(search.getFilterValues('has2fa')),
  };

  const handleBoolFilter = (key: keyof Filters) => (opt: SelectOption<string>) => {
    const newQueryObject = search.copy();
    newQueryObject.removeFilter(key);
    if (opt.value !== 'all') {
      newQueryObject.setFilterValues(key, [opt.value]);
    }

    onChange(newQueryObject.formatString());
  };

  return (
    <CompositeSelect
      triggerProps={{icon: <IconSliders />, size: 'md'}}
      triggerLabel={t('Filter')}
      maxMenuHeight="22rem"
      size="sm"
    >
      <CompositeSelect.Region
        multiple
        label={t('Role')}
        value={filters.roles}
        options={roles.map(({id, name}) => ({value: id, label: name}))}
        onChange={opts => {
          const newSearch = search.copy();
          newSearch.setFilterValues(
            'role',
            opts.map(opt => opt.value)
          );
          onChange(newSearch.formatString());
        }}
      />
      <CompositeSelect.Region
        label={t('Invited')}
        options={booleanOptions}
        value={filters.isInvited}
        onChange={handleBoolFilter('isInvited')}
        closeOnSelect={false}
      />
      <CompositeSelect.Region
        label={t('2FA')}
        options={booleanOptions}
        value={filters.has2fa}
        onChange={handleBoolFilter('has2fa')}
        closeOnSelect={false}
      />
      <CompositeSelect.Region
        label={t('SSO Linked')}
        options={booleanOptions}
        value={filters.ssoLinked}
        onChange={handleBoolFilter('ssoLinked')}
        closeOnSelect={false}
      />
    </CompositeSelect>
  );
}

export default MembersFilter;
