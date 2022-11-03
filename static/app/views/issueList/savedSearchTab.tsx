import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import CompactSelect from 'sentry/components/compactSelect';
import Confirm from 'sentry/components/confirm';
import DropdownButton from 'sentry/components/dropdownButton';
import {ControlProps} from 'sentry/components/forms/controls/selectControl';
import QueryCount from 'sentry/components/queryCount';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';
import {defined} from 'sentry/utils';

import {getSortLabel} from './utils';

type Props = {
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  organization: Organization;
  savedSearchList: SavedSearch[];
  sort: string;
  isActive?: boolean;
  query?: string;
  queryCount?: number;
};

function SavedSearchTab({
  isActive,
  organization,
  savedSearchList,
  onSavedSearchSelect,
  onSavedSearchDelete,
  query,
  queryCount,
  sort,
}: Props) {
  const savedSearch = savedSearchList.find(
    search => search.query === query && search.sort === sort
  );
  const savedSearchValue = savedSearch
    ? savedSearch.isGlobal
      ? `global-search-${savedSearch.id}`
      : `saved-search-${savedSearch.id}`
    : '';

  const options: ControlProps['options'] = useMemo(() => {
    const savedSearches = savedSearchList.filter(search => !search.isGlobal);
    const globalSearches = savedSearchList.filter(
      search => search.isGlobal && !search.isPinned && search.query !== 'is:unresolved'
    );

    function getSearchOption(search, keyPrefix) {
      return {
        value: `${keyPrefix}-${search.id}`,
        label: search.name,
        details: (
          <Details>
            {search.query}
            {` \u2022 ${t('Sort:')} ${getSortLabel(search.sort)}`}
          </Details>
        ),
        tooltip: (
          <Fragment>
            {`${search.name} \u2022 `}
            <TooltipSearchQuery>{search.query}</TooltipSearchQuery>
            {` \u2022 `}
            {t('Sort: ')}
            {getSortLabel(search.sort)}
          </Fragment>
        ),
        tooltipOptions: {delay: 1000},
        ...(!search.isPinned &&
          !search.isGlobal && {
            trailingItems: (
              <Access
                organization={organization}
                access={['org:write']}
                renderNoAccessMessage={false}
              >
                <Confirm
                  onConfirm={() => onSavedSearchDelete(search)}
                  message={t('Are you sure you want to delete this saved search?')}
                  stopPropagation
                >
                  <DeleteButton
                    borderless
                    icon={<IconDelete />}
                    aria-label={t('delete')}
                    size="zero"
                  />
                </Confirm>
              </Access>
            ),
          }),
        trailingItemsSpanFullHeight: true,
      };
    }

    const searchOptions: ControlProps['options'] = [];

    if (savedSearches.length > 0) {
      searchOptions.push({
        value: 'saved-searches',
        label: t('Saved Searches'),
        options: savedSearches.map(search => getSearchOption(search, 'saved-search')),
      });
    }

    if (globalSearches.length > 0) {
      searchOptions.push({
        value: 'global-searches',
        label: t('Recommended Searches'),
        options: globalSearches.map(search => getSearchOption(search, 'global-search')),
      });
    }

    return searchOptions;
  }, []);

  const trigger = props => (
    <StyledDropdownTrigger
      {...props}
      isActive={isActive}
      borderless
      priority="link"
      size="zero"
    >
      {isActive ? (
        <Fragment>
          <span>{savedSearch ? savedSearch.name : t('Custom Search')}&nbsp;</span>
          {defined(queryCount) && queryCount > 0 && (
            <Badge>
              <QueryCount hideParens count={queryCount} max={1000} />
            </Badge>
          )}
        </Fragment>
      ) : (
        t('Saved Searches')
      )}
    </StyledDropdownTrigger>
  );

  const onChange = useCallback(
    option => {
      const searchObj = savedSearchList.find(s =>
        s.isGlobal
          ? `global-search-${s.id}` === option.value
          : `saved-search-${s.id}` === option.value
      );
      searchObj && onSavedSearchSelect(searchObj);
    },
    [savedSearchList, onSavedSearchSelect]
  );

  return (
    <StyledCompactSelect
      renderWrapAs="li"
      trigger={trigger}
      options={options}
      value={savedSearchValue}
      isActive={isActive}
      onChange={onChange}
      offset={-4}
      maxMenuHeight={800}
    />
  );
}

export default SavedSearchTab;

const StyledCompactSelect = styled(CompactSelect)<{isActive?: boolean}>`
  && {
    position: static;
  }
  border-bottom-width: 4px;
  border-bottom-style: solid;
  border-bottom-color: ${p => (p.isActive ? p.theme.active : 'transparent')};
`;

const StyledDropdownTrigger = styled(DropdownButton)<{isActive?: boolean}>`
  display: flex;
  height: calc(1.25rem - 2px);
  align-items: center;
  color: ${p => (p.isActive ? p.theme.textColor : p.theme.subText)};
  box-sizing: content-box;
  padding: ${space(1)} 0;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const Details = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  max-width: 16rem;
  ${p => p.theme.overflowEllipsis}
`;

const TooltipSearchQuery = styled('span')`
  color: ${p => p.theme.subText};
  font-weight: normal;
  font-family: ${p => p.theme.text.familyMono};
`;

const DeleteButton = styled(Button)`
  color: ${p => p.theme.subText};
  flex-shrink: 0;
  padding: ${space(1)} 0;

  :hover {
    color: ${p => p.theme.error};
  }
`;
