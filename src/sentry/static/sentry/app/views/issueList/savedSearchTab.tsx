import React from 'react';
import styled from '@emotion/styled';

import DropdownLink from 'app/components/dropdownLink';
import ExternalLink from 'app/components/links/externalLink';
import QueryCount from 'app/components/queryCount';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, SavedSearch} from 'app/types';

import SavedSearchMenu from './savedSearchMenu';

type Props = {
  organization: Organization;
  savedSearchList: SavedSearch[];
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
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
  const tooltipTitle = tct(
    `Create [link:saved searches] to quickly access other types of issues that you care about.`,
    {
      link: (
        <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/#organization-wide-saved-searches" />
      ),
    }
  );

  const title = (
    <Tooltip title={tooltipTitle} position="bottom" isHoverable delay={1000}>
      <TitleWrapper>
        {isActive ? (
          <React.Fragment>
            <TitleTextOverflow>
              {savedSearch ? savedSearch.name : t('Custom Search')}{' '}
            </TitleTextOverflow>
            <StyledQueryCount isTag count={queryCount} max={1000} />
          </React.Fragment>
        ) : (
          t('Saved Searches')
        )}
      </TitleWrapper>
    </Tooltip>
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
          sort={sort}
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
    min-width: 20vw;
    max-width: 25vw;
    z-index: ${p => p.theme.zIndex.globalSelectionHeader};
  }

  @media (max-width: ${p => p.theme.breakpoints[4]}) {
    & > span > .dropdown-menu {
      max-width: 35vw;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    & > span > .dropdown-menu {
      max-width: 50vw;
    }
  }

  /* Fix nav tabs style leaking into menu */
  * > li {
    margin: 0;
  }
`;

const TitleWrapper = styled('span')`
  margin-right: ${space(0.5)};
  user-select: none;
  display: flex;
  align-items: center;
`;

const TitleTextOverflow = styled('span')`
  margin-right: ${space(0.5)};
  max-width: 150px;
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
