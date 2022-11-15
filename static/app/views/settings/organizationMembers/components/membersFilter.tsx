import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {OrgRole} from 'sentry/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

type Props = {
  onChange: (query: string) => void;
  query: string;
  roles: OrgRole[];
  className?: string;
};

type BooleanFilterProps = {
  label: string;
  onChange: (value: boolean | null) => void;
  value: boolean | null;
};

type Filters = {
  has2fa: boolean | null;
  isInvited: boolean | null;
  roles: string[];
  ssoLinked: boolean | null;
};

const getBoolean = (list: string[]) =>
  Array.isArray(list) && list.length
    ? list && list.map(v => v.toLowerCase()).includes('true')
    : null;

const MembersFilter = ({className, roles, query, onChange}: Props) => {
  const search = new MutableSearch(query);

  const filters = {
    roles: search.getFilterValues('role') || [],
    isInvited: getBoolean(search.getFilterValues('isInvited')),
    ssoLinked: getBoolean(search.getFilterValues('ssoLinked')),
    has2fa: getBoolean(search.getFilterValues('has2fa')),
  };

  const handleRoleFilter = (id: string) => () => {
    const roleList = new Set(
      search.getFilterValues('role') ? [...search.getFilterValues('role')] : []
    );

    if (roleList.has(id)) {
      roleList.delete(id);
    } else {
      roleList.add(id);
    }

    const newSearch = search.copy();
    newSearch.setFilterValues('role', [...roleList]);
    onChange(newSearch.formatString());
  };

  const handleBoolFilter = (key: keyof Filters) => (value: boolean | null) => {
    const newQueryObject = search.copy();
    newQueryObject.removeFilter(key);
    if (value !== null) {
      newQueryObject.setFilterValues(key, [Boolean(value).toString()]);
    }

    onChange(newQueryObject.formatString());
  };

  return (
    <FilterContainer className={className}>
      <FilterHeader>{t('Filter By')}</FilterHeader>

      <FilterLists>
        <FilterList>
          <h3>{t('User Role')}</h3>
          {roles.map(({id, name}) => (
            <label key={id}>
              <Checkbox
                data-test-id={`filter-role-${id}`}
                checked={filters.roles.includes(id)}
                onChange={handleRoleFilter(id)}
              />
              {name}
            </label>
          ))}
        </FilterList>

        <FilterList>
          <h3>{t('Status')}</h3>
          <BooleanFilter
            data-test-id="filter-isInvited"
            onChange={handleBoolFilter('isInvited')}
            value={filters.isInvited}
            label={t('Invited')}
          />
          <BooleanFilter
            data-test-id="filter-has2fa"
            onChange={handleBoolFilter('has2fa')}
            value={filters.has2fa}
            label={t('2FA')}
          />
          <BooleanFilter
            data-test-id="filter-ssoLinked"
            onChange={handleBoolFilter('ssoLinked')}
            value={filters.ssoLinked}
            label={t('SSO Linked')}
          />
        </FilterList>
      </FilterLists>
    </FilterContainer>
  );
};

const BooleanFilter = ({onChange, value, label}: BooleanFilterProps) => (
  <label>
    <Checkbox
      aria-label={t('Enable %s filter', label)}
      checked={value !== null}
      onChange={() => onChange(value === null ? true : null)}
    />
    {label}
    <Switch
      aria-label={t('Toggle %s', label)}
      isDisabled={value === null}
      isActive={value === true}
      toggle={() => onChange(!value)}
    />
  </label>
);

const FilterContainer = styled('div')`
  border-radius: 4px;
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.border};
`;

const FilterHeader = styled('h2')`
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(1)};
  margin: 0;
`;

const FilterLists = styled('div')`
  display: grid;
  grid-template-columns: 100px max-content;
  gap: ${space(3)};
  margin: ${space(1.5)};
  margin-top: ${space(0.75)};
`;

const FilterList = styled('div')`
  display: grid;
  grid-template-rows: repeat(auto-fit, minmax(0, max-content));
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};

  h3 {
    color: #000;
    font-size: ${p => p.theme.fontSizeSmall};
    text-transform: uppercase;
    margin: ${space(1)} 0;
  }

  label {
    display: grid;
    grid-template-columns: max-content 1fr max-content;
    gap: ${space(0.75)};
    align-items: center;
    font-weight: normal;
    white-space: nowrap;
    height: ${space(2)};
  }

  input,
  label {
    margin: 0;
  }
`;
export default MembersFilter;
