import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {MemberRole} from 'app/types';
import space from 'app/styles/space';
import Checkbox from 'app/components/checkbox';
import Switch from 'app/components/switch';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';

type Props = {
  className?: string;
  roles: MemberRole[];
  query: string;
  onChange: (query: string) => void;
};

type BooleanFilterProps = {
  onChange: (value: boolean | null) => void;
  value: boolean | null;
  children: React.ReactNode;
};

type Filters = {
  roles: string[];
  isInvited: boolean | null;
  ssoLinked: boolean | null;
  has2fa: boolean | null;
};

const getBoolean = (list: string[]) =>
  Array.isArray(list) ? list && list.map(v => v.toLowerCase()).includes('true') : null;

const MembersFilter = ({className, roles, query, onChange}: Props) => {
  const search = tokenizeSearch(query);

  const filters = {
    roles: search.getTagValues('role') || [],
    isInvited: getBoolean(search.getTagValues('isInvited')),
    ssoLinked: getBoolean(search.getTagValues('ssoLinked')),
    has2fa: getBoolean(search.getTagValues('has2fa')),
  };

  const handleRoleFilter = (id: string) => () => {
    const roleList = new Set(
      search.getTagValues('role') ? [...search.getTagValues('role')] : []
    );

    if (roleList.has(id)) {
      roleList.delete(id);
    } else {
      roleList.add(id);
    }

    const newSearch = search.copy();
    newSearch.setTagValues('role', [...roleList]);
    onChange(stringifyQueryObject(newSearch));
  };

  const handleBoolFilter = (key: keyof Filters) => (value: boolean | null) => {
    const newQueryObject = search.copy();
    newQueryObject.removeTag(key);
    if (value !== null) {
      newQueryObject.setTagValues(key, [Boolean(value).toString()]);
    }

    onChange(stringifyQueryObject(newQueryObject));
  };

  return (
    <FilterContainer className={className}>
      <FilterHeader>{t('Filter By')}</FilterHeader>

      <FilterLists>
        <Filters>
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
        </Filters>

        <Filters>
          <h3>{t('Status')}</h3>
          <BooleanFilter
            data-test-id="filter-isInvited"
            onChange={handleBoolFilter('isInvited')}
            value={filters.isInvited}
          >
            {t('Invited')}
          </BooleanFilter>
          <BooleanFilter
            data-test-id="filter-has2fa"
            onChange={handleBoolFilter('has2fa')}
            value={filters.has2fa}
          >
            {t('2FA')}
          </BooleanFilter>
          <BooleanFilter
            data-test-id="filter-ssoLinked"
            onChange={handleBoolFilter('ssoLinked')}
            value={filters.ssoLinked}
          >
            {t('SSO Linked')}
          </BooleanFilter>
        </Filters>
      </FilterLists>
    </FilterContainer>
  );
};

const BooleanFilter = ({onChange, value, children}: BooleanFilterProps) => (
  <label>
    <Checkbox
      checked={value !== null}
      onChange={() => onChange(value === null ? true : null)}
    />
    {children}
    <Switch
      isDisabled={value === null}
      isActive={value === true}
      toggle={() => onChange(!value)}
    />
  </label>
);

MembersFilter.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.object).isRequired as any,
  query: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

BooleanFilter.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOf([null, true, false]),
};

const FilterContainer = styled('div')`
  border-radius: 4px;
  background: #fff;
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.borderLight};
`;

const FilterHeader = styled('h2')`
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.gray100};
  color: ${p => p.theme.gray600};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(1)};
  margin: 0;
`;

const FilterLists = styled('div')`
  display: grid;
  grid-template-columns: 100px max-content;
  grid-gap: ${space(3)};
  margin: ${space(1.5)};
  margin-top: ${space(0.75)};
`;

const Filters = styled('div')`
  display: grid;
  grid-template-rows: repeat(auto-fit, minmax(0, max-content));
  grid-gap: ${space(1)};
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
    grid-gap: ${space(0.75)};
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
