import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import CreateSavedSearchModal from 'sentry/components/modals/createSavedSearchModal';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

interface SavedIssueSearchesProps {
  isOpen: boolean;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  organization: Organization;
  query: string;
  savedSearch: SavedSearch | null;
  savedSearchLoading: boolean;
  savedSearches: SavedSearch[];
  sort: string;
}

interface SavedSearchItemProps
  extends Pick<
    SavedIssueSearchesProps,
    'organization' | 'onSavedSearchDelete' | 'onSavedSearchSelect'
  > {
  savedSearch: SavedSearch;
}

type CreateNewSavedSearchButtonProps = Pick<
  SavedIssueSearchesProps,
  'query' | 'sort' | 'organization'
>;

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
            <Button
              {...props}
              aria-label={t('Saved search options')}
              borderless
              icon={<IconEllipsis size="sm" />}
              size="sm"
            />
          )}
        />
      )}
    </SearchListItem>
  );
};

function CreateNewSavedSearchButton({
  organization,
  query,
  sort,
}: CreateNewSavedSearchButtonProps) {
  const disabled = !organization.access.includes('org:write');

  const title = disabled
    ? t('You do not have permission to create a saved search')
    : t('Create a new saved search for your organization');

  const onClick = () => {
    trackAdvancedAnalyticsEvent('search.saved_search_open_create_modal', {
      organization,
    });
    openModal(deps => (
      <CreateSavedSearchModal {...deps} {...{organization, query, sort}} />
    ));
  };

  return (
    <Button
      aria-label={t('Create a new saved search for your organization')}
      disabled={disabled}
      onClick={onClick}
      icon={<IconAdd size="sm" />}
      title={title}
      borderless
      size="sm"
    />
  );
}

const SavedIssueSearches = ({
  organization,
  isOpen,
  onSavedSearchDelete,
  onSavedSearchSelect,
  savedSearchLoading,
  savedSearches,
  query,
  sort,
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
          <HeadingContainer>
            <Heading>{t('Saved Searches')}</Heading>
            <CreateNewSavedSearchButton {...{organization, query, sort}} />
          </HeadingContainer>
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
          <HeadingContainer>
            <Heading>{t('Recommended')}</Heading>
          </HeadingContainer>
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
  padding: ${space(3)} ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    border-bottom: 1px solid ${p => p.theme.gray200};
    padding: ${space(2)} 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    border-left: 1px solid ${p => p.theme.gray200};
  }
`;

const HeadingContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 38px;
  &:first-of-type {
    margin-top: 0;
  }
  margin: ${space(3)} 0 ${space(2)} ${space(2)};
`;

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
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

  padding: ${space(1)} ${p => (p.hasMenu ? '60px' : space(2))} ${space(1)} ${space(2)};
  margin-top: 2px;
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

export default SavedIssueSearches;
