import React from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import {IconDelete} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, SavedSearch} from 'app/types';

import {getSortLabel} from './utils';

type MenuItemProps = Omit<Props, 'savedSearchList'> & {
  search: SavedSearch;
  isLast: boolean;
};

function SavedSearchMenuItem({
  organization,
  onSavedSearchSelect,
  onSavedSearchDelete,
  search,
  query,
  sort,
  isLast,
}: MenuItemProps) {
  return (
    <Tooltip
      title={
        <React.Fragment>
          {`${search.name} \u2022 `}
          <TooltipSearchQuery>{search.query}</TooltipSearchQuery>
          {` \u2022 `}
          {t('Sort: ')}
          {getSortLabel(search.sort)}
        </React.Fragment>
      }
      containerDisplayMode="block"
      delay={1000}
    >
      <StyledMenuItem
        isActive={search.query === query && search.sort === sort}
        isLast={isLast}
      >
        <MenuItemLink tabIndex={-1} onClick={() => onSavedSearchSelect(search)}>
          <SearchTitle>{search.name}</SearchTitle>
          <SearchQueryContainer>
            <SearchQuery>{search.query}</SearchQuery>
            <SearchSort>
              {t('Sort: ')}
              {getSortLabel(search.sort)}
            </SearchSort>
          </SearchQueryContainer>
        </MenuItemLink>
        {search.isGlobal === false && search.isPinned === false && (
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
                title={t('Delete this saved search')}
                icon={<IconDelete />}
                label={t('delete')}
                size="zero"
              />
            </Confirm>
          </Access>
        )}
      </StyledMenuItem>
    </Tooltip>
  );
}

type Props = {
  savedSearchList: SavedSearch[];
  organization: Organization;
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  sort: string;
  query?: string;
};

function SavedSearchMenu({savedSearchList, ...props}: Props) {
  const savedSearches = savedSearchList.filter(search => !search.isGlobal);
  const commonSearches = savedSearchList.filter(search => search.isGlobal);

  return (
    <MenuContainer>
      <MenuHeader>{t('Saved Searches')}</MenuHeader>
      {savedSearches.length === 0 ? (
        <EmptyItem>{t('No saved searches yet.')}</EmptyItem>
      ) : (
        savedSearches.map((search, index) => (
          <SavedSearchMenuItem
            key={search.id}
            search={search}
            isLast={index === savedSearches.length - 1}
            {...props}
          />
        ))
      )}
      <SecondaryMenuHeader>{t('Common Searches')}</SecondaryMenuHeader>
      {commonSearches.length === 0 ? (
        <EmptyItem>{t('No common searches')}</EmptyItem>
      ) : (
        commonSearches.map((search, index) => (
          <SavedSearchMenuItem
            key={search.id}
            search={search}
            isLast={index === commonSearches.length - 1}
            {...props}
          />
        ))
      )}
    </MenuContainer>
  );
}

export default SavedSearchMenu;

const SearchTitle = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis}
`;

const SearchQueryContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  line-height: 1;
  ${overflowEllipsis}
`;

const SearchQuery = styled('code')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 0;
  background: inherit;
`;

const SearchSort = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  &:before {
    font-size: ${p => p.theme.fontSizeExtraSmall};
    color: ${p => p.theme.textColor};
    content: ' \u2022 ';
  }
`;

const TooltipSearchQuery = styled('span')`
  color: ${p => p.theme.gray200};
  font-weight: normal;
  font-family: ${p => p.theme.text.familyMono};
`;

const DeleteButton = styled(Button)`
  color: ${p => p.theme.gray200};
  background: transparent;
  flex-shrink: 0;
  padding: ${space(1)} 0;

  &:hover {
    background: transparent;
    color: ${p => p.theme.blue300};
  }
`;

const MenuContainer = styled('div')`
  margin: -5px 0;
`;

const MenuHeader = styled('div')`
  align-items: center;
  color: ${p => p.theme.gray400};
  font-weight: 400;
  background: ${p => p.theme.backgroundSecondary};
  line-height: 0.75;
  padding: ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
`;

const SecondaryMenuHeader = styled(MenuHeader)`
  border-top: 1px solid ${p => p.theme.border};
  border-radius: 0;
`;

const StyledMenuItem = styled(MenuItem)<{isActive: boolean; isLast: boolean}>`
  border-bottom: ${p => (!p.isLast ? `1px solid ${p.theme.innerBorder}` : null)};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;

  & > a {
    padding: ${space(0.75)} 0;
  }

  ${p =>
    p.isActive &&
    `
  ${SearchTitle}, ${SearchQuery}, ${SearchSort} {
    color: ${p.theme.white};
  }
  ${SearchSort}:before {
    color: ${p.theme.white};
  }
  &:hover {
    ${SearchTitle}, ${SearchQuery}, ${SearchSort} {
      color: ${p.theme.black};
    }
    ${SearchSort}:before {
      color: ${p.theme.black};
    }
  }
  `}
`;

const MenuItemLink = styled('a')`
  display: block;
  flex-grow: 1;
  padding: ${space(0.5)} 0;
  /* Nav tabs style override */
  border: 0;

  ${overflowEllipsis}
`;

const EmptyItem = styled('li')`
  padding: ${space(1)} ${space(1.5)};
  color: ${p => p.theme.subText};
`;
