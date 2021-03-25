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

type Props = {
  organization: Organization;
  savedSearchList: SavedSearch[];
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  sort: string;
  query?: string;
};

function SavedSearchMenu({
  savedSearchList,
  onSavedSearchDelete,
  onSavedSearchSelect,
  organization,
  sort,
  query,
}: Props) {
  if (savedSearchList.length === 0) {
    return <EmptyItem>{t("There don't seem to be any saved searches yet.")}</EmptyItem>;
  }

  return (
    <React.Fragment>
      {savedSearchList.map((search, index) => (
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
          key={search.id}
        >
          <StyledMenuItem
            isActive={search.query === query && search.sort === sort}
            last={index === savedSearchList.length - 1}
          >
            <MenuItemLink tabIndex={-1} onClick={() => onSavedSearchSelect(search)}>
              <SearchTitle>{search.name}</SearchTitle>
              <SearchQuery>{search.query}</SearchQuery>
              <SearchSort>
                {t('Sort: ')}
                {getSortLabel(search.sort)}
              </SearchSort>
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
      ))}
    </React.Fragment>
  );
}

export default SavedSearchMenu;

const SearchTitle = styled('strong')`
  color: ${p => p.theme.textColor};

  &:after {
    content: ' \u2022 ';
  }
`;

const SearchQuery = styled('code')`
  color: ${p => p.theme.textColor};
  padding: 0;
  background: inherit;
`;

const SearchSort = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};

  &:before {
    font-size: ${p => p.theme.fontSizeMedium};
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

const StyledMenuItem = styled(MenuItem)<{isActive: boolean; last: boolean}>`
  border-bottom: ${p => (!p.last ? `1px solid ${p.theme.innerBorder}` : null)};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;

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
  padding: 8px 10px 5px;
  font-style: italic;
`;
