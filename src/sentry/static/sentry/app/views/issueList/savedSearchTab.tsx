import React from 'react';
import styled from '@emotion/styled';

import DropdownLink from 'app/components/dropdownLink';
import QueryCount from 'app/components/queryCount';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, SavedSearch} from 'app/types';

import SavedSearchMenu from './savedSearchMenu';

type Props = {
  organization: Organization;
  savedSearchList: SavedSearch[];
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
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
}: Props) {
  const savedSearch = savedSearchList.find(search => query === search.query);
  const title = (
    <TitleWrapper>
      {isActive ? (
        <React.Fragment>
          {savedSearch ? savedSearch.name : t('Custom Search')}{' '}
          <StyledQueryCount isTag count={queryCount} max={1000} />
        </React.Fragment>
      ) : (
        t('More')
      )}
    </TitleWrapper>
  );

  return (
    <TabWrapper isActive={isActive} className="saved-search-tab">
      <StyledDropdownLink
        alwaysRenderMenu={false}
        anchorMiddle
        caret
        title={title}
        isActive={isActive}
      >
        <SavedSearchMenu
          organization={organization}
          savedSearchList={savedSearchList}
          onSavedSearchSelect={onSavedSearchSelect}
          onSavedSearchDelete={onSavedSearchDelete}
          query={query}
        />
      </StyledDropdownLink>
    </TabWrapper>
  );
}

export default SavedSearchTab;

const TabWrapper = styled('li')<{isActive?: boolean}>`
  /* Color matches nav-tabs - overwritten using dark mode class saved-search-tab */
  border-bottom: ${p => (p.isActive ? `4px solid #6c5fc7` : 0)};
  /* Reposition menu under caret */
  & > span {
    display: block;
  }
  & > span > .dropdown-menu {
    margin-top: ${space(1)};
    min-width: 30vw;
    max-width: 35vw;
    z-index: ${p => p.theme.zIndex.globalSelectionHeader};
  }

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    & > span > .dropdown-menu {
      max-width: 50vw;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    & > span > .dropdown-menu {
      max-width: 55vw;
    }
  }

  /* Fix nav tabs style leaking into menu */
  * > li {
    margin: 0;
  }
`;

const TitleWrapper = styled('span')`
  margin-right: ${space(0.5)};
  max-width: 150px;
  user-select: none;
  ${overflowEllipsis};
`;

const StyledDropdownLink = styled(DropdownLink)<{isActive?: boolean}>`
  position: relative;
  display: block;
  padding: ${space(1)} 0;
  /* Important to override a media query from .nav-tabs */
  font-size: ${p => p.theme.fontSizeLarge} !important;
  text-align: center;
  text-transform: capitalize;
  /* TODO(scttcper): Replace hex color when nav-tabs is replaced */
  color: ${p => (p.isActive ? p.theme.textColor : '#7c6a8e')};

  :hover {
    color: #2f2936;
  }
`;

const StyledQueryCount = styled(QueryCount)`
  color: ${p => p.theme.gray300};
`;
