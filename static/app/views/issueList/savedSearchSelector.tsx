import React from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'app/components/dropdownButton';
import DropdownControl from 'app/components/dropdownControl';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Organization, SavedSearch} from 'app/types';

import SavedSearchMenu from './savedSearchMenu';

type Props = {
  organization: Organization;
  savedSearchList: SavedSearch[];
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  sort: string;
  query?: string;
};

function SavedSearchSelector({
  savedSearchList,
  onSavedSearchDelete,
  onSavedSearchSelect,
  organization,
  query,
  sort,
}: Props) {
  function getTitle() {
    const savedSearch = savedSearchList.find(
      search => search.query === query && search.sort === sort
    );
    return savedSearch ? savedSearch.name : t('Custom Search');
  }

  return (
    <DropdownControl
      menuWidth="35vw"
      blendWithActor
      button={({isOpen, getActorProps}) => (
        <StyledDropdownButton {...getActorProps()} isOpen={isOpen}>
          <ButtonTitle>{getTitle()}</ButtonTitle>
        </StyledDropdownButton>
      )}
    >
      <SavedSearchMenu
        organization={organization}
        savedSearchList={savedSearchList}
        onSavedSearchSelect={onSavedSearchSelect}
        onSavedSearchDelete={onSavedSearchDelete}
        query={query}
        sort={sort}
      />
    </DropdownControl>
  );
}

export default SavedSearchSelector;

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.textColor};
  background-color: ${p => p.theme.background};
  border-right: 0;
  border-color: ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  border-radius: ${p =>
    p.isOpen
      ? `${p.theme.borderRadius} 0 0 0`
      : `${p.theme.borderRadius} 0 0 ${p.theme.borderRadius}`};
  white-space: nowrap;
  max-width: 200px;
  margin-right: 0;

  &:hover,
  &:focus,
  &:active {
    border-color: ${p => p.theme.border};
    border-right: 0;
  }
`;

const ButtonTitle = styled('span')`
  ${overflowEllipsis}
`;
