import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

interface SavedIssueSearchesProps {
  isOpen: boolean;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  organization: Organization;
  savedSearch: SavedSearch | null;
  savedSearchLoading: boolean;
  savedSearches: SavedSearch[];
}

interface SavedSearchItemProps
  extends Pick<
    SavedIssueSearchesProps,
    'organization' | 'onSavedSearchDelete' | 'onSavedSearchSelect'
  > {
  savedSearch: SavedSearch;
}

const SavedSearchItem = ({
  organization,
  onSavedSearchDelete,
  onSavedSearchSelect,
  savedSearch,
}: SavedSearchItemProps) => {
  const hasOrgWriteAccess = organization.access?.includes('org:write');

  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: 'Edit',
      disabled: true,
      details: 'Not yet supported',
    },
    {
      disabled: !hasOrgWriteAccess,
      details: !hasOrgWriteAccess
        ? t('You do not have permission to delete this search.')
        : '',
      key: 'delete',
      label: t('Delete'),
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to delete this saved search?'),
          onConfirm: () => onSavedSearchDelete(savedSearch),
        });
      },
      priority: 'danger',
    },
  ];

  return (
    <SearchListItem>
      <StyledItemButton
        aria-label={savedSearch.name}
        onClick={() => onSavedSearchSelect(savedSearch)}
        hasMenu={!savedSearch.isGlobal}
      >
        <div>
          <SavedSearchItemTitle>{savedSearch.name}</SavedSearchItemTitle>
          <SavedSearchItemDescription>{savedSearch.query}</SavedSearchItemDescription>
        </div>
      </StyledItemButton>
      {!savedSearch.isGlobal && (
        <OverflowMenu
          position="bottom-end"
          items={actions}
          size="sm"
          trigger={props => (
            <OverflowMenuTrigger
              {...props}
              aria-label={t('Saved search options')}
              icon={<IconEllipsis size="sm" />}
            />
          )}
        />
      )}
    </SearchListItem>
  );
};

const SavedIssueSearches = ({
  organization,
  isOpen,
  onSavedSearchDelete,
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

  const orgSavedSearches = savedSearches.filter(
    search => !search.isGlobal && !search.isPinned
  );
  const recommendedSavedSearches = savedSearches.filter(search => search.isGlobal);

  return (
    <StyledSidebar>
      {orgSavedSearches.length > 0 && (
        <Fragment>
          <Heading>{t('Saved Searches')}</Heading>
          <SearchesContainer>
            {orgSavedSearches.map(item => (
              <SavedSearchItem
                key={item.id}
                organization={organization}
                onSavedSearchDelete={onSavedSearchDelete}
                onSavedSearchSelect={onSavedSearchSelect}
                savedSearch={item}
              />
            ))}
          </SearchesContainer>
        </Fragment>
      )}
      {recommendedSavedSearches.length > 0 && (
        <Fragment>
          <Heading>{t('Recommended')}</Heading>
          <SearchesContainer>
            {recommendedSavedSearches.map(item => (
              <SavedSearchItem
                key={item.id}
                organization={organization}
                onSavedSearchDelete={onSavedSearchDelete}
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

const StyledItemButton = styled('button')<{hasMenu?: boolean}>`
  width: 100%;
  background: ${p => p.theme.white};
  border: 0;
  border-radius: ${p => p.theme.borderRadius};
  text-align: left;
  display: block;

  padding: ${space(1)} ${p => (p.hasMenu ? '50px' : space(2))} ${space(1)} ${space(2)};
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

const OverflowMenu = styled(DropdownMenuControl)`
  position: absolute;
  top: 12px;
  right: ${space(1)};
`;

const OverflowMenuTrigger = styled(Button)<{isActive?: boolean}>`
  border: 0;
  height: 30px;
  width: 30px;
  background: ${p => (p.isActive ? p.theme.hover : 'none')};
  color: ${p => p.theme.textColor};
  box-shadow: none;
  cursor: pointer;

  &:hover,
  &:focus {
    background: ${p => p.theme.hover};
    color: ${p => p.theme.textColor};
  }
`;

export default SavedIssueSearches;
