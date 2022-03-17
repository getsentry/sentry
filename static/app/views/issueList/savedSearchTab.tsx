import {Fragment} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import DropdownLink from 'sentry/components/dropdownLink';
import QueryCount from 'sentry/components/queryCount';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

import SavedSearchMenu from './savedSearchMenu';

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

  const title = (
    <TitleWrapper>
      {isActive ? (
        <Fragment>
          <TitleTextOverflow>
            {savedSearch ? savedSearch.name : t('Custom Search')}{' '}
          </TitleTextOverflow>
          {queryCount !== undefined && queryCount > 0 && (
            <div>
              <Badge>
                <QueryCount hideParens count={queryCount} max={1000} />
              </Badge>
            </div>
          )}
        </Fragment>
      ) : (
        t('Saved Searches')
      )}
    </TitleWrapper>
  );

  return (
    <TabWrapper
      isActive={isActive}
      className="saved-search-tab"
      data-test-id="saved-search-tab"
    >
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
    padding: 0;
    margin-top: ${space(1)};
    min-width: 20vw;
    max-width: 25vw;
    z-index: ${p => p.theme.zIndex.globalSelectionHeader};

    :after {
      border-bottom-color: ${p => p.theme.backgroundSecondary};
    }
  }

  @media (max-width: ${p => p.theme.breakpoints[4]}) {
    & > span > .dropdown-menu {
      max-width: 30vw;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    & > span > .dropdown-menu {
      max-width: 50vw;
    }
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
