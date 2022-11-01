import {Fragment} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

interface SavedIssueSearchesProps {
  isOpen: boolean;
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  organization: Organization;
  savedSearch: SavedSearch | null;
  savedSearchLoading: boolean;
  savedSearches: SavedSearch[];
}

interface SavedSearchItemProps {
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  savedSearch: SavedSearch;
}

const SavedSearchItem = ({onSavedSearchSelect, savedSearch}: SavedSearchItemProps) => {
  return (
    <SearchListItem>
      <StyledItemButton
        aria-label={savedSearch.name}
        onClick={() => onSavedSearchSelect(savedSearch)}
      >
        <div>
          <SavedSearchItemTitle>{savedSearch.name}</SavedSearchItemTitle>
          <SavedSearchItemDescription>{savedSearch.query}</SavedSearchItemDescription>
        </div>
      </StyledItemButton>
    </SearchListItem>
  );
};

const SavedIssueSearches = ({
  organization,
  isOpen,
  onSavedSearchSelect,
  savedSearchLoading,
  savedSearches,
}: SavedIssueSearchesProps) => {
  if (!isOpen) {
    return null;
  }

  if (!organization.features.includes('issue-list-saved-searches-v2')) {
    return null;
  }

  if (savedSearchLoading) {
    return (
      <StyledSidebar>
        <LoadingIndicator />
      </StyledSidebar>
    );
  }

  const [recommendedSavedSearches, orgSavedSearches] = partition(
    savedSearches,
    item => item.isGlobal
  );

  return (
    <StyledSidebar>
      {orgSavedSearches.length > 0 && (
        <Fragment>
          <Heading>Saved Searches</Heading>
          <SearchesContainer>
            {orgSavedSearches.map(item => (
              <SavedSearchItem
                key={item.id}
                onSavedSearchSelect={onSavedSearchSelect}
                savedSearch={item}
              />
            ))}
          </SearchesContainer>
        </Fragment>
      )}
      {recommendedSavedSearches.length > 0 && (
        <Fragment>
          <Heading>Recommended</Heading>
          <SearchesContainer>
            {recommendedSavedSearches.map(item => (
              <SavedSearchItem
                key={item.id}
                onSavedSearchSelect={onSavedSearchSelect}
                savedSearch={item}
              />
            ))}
          </SearchesContainer>
        </Fragment>
      )}
    </StyledSidebar>
  );
};

const StyledSidebar = styled('aside')`
  width: 360px;
  padding: ${space(4)} ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    border-bottom: 1px solid ${p => p.theme.gray200};
    padding: ${space(2)} 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    border-left: 1px solid ${p => p.theme.gray200};
  }
`;

const Heading = styled('h2')`
  &:first-of-type {
    margin-top: 0;
  }

  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: ${space(3)} 0 ${space(2)} ${space(2)};
`;

const SearchesContainer = styled('ul')`
  padding: 0;
  margin-bottom: ${space(1)};
`;

const SearchListItem = styled('li')`
  position: relative;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const StyledItemButton = styled('button')`
  width: 100%;
  background: ${p => p.theme.white};
  border: 0;
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  display: block;

  padding: ${space(1)} ${space(2)};
  margin-top: 2px;

  &:hover {
    background: ${p => p.theme.hover};
  }
`;

const SavedSearchItemTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const SavedSearchItemDescription = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export default SavedIssueSearches;
