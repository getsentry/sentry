import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {CreateSavedSearchModal} from 'sentry/components/modals/savedSearchModal/createSavedSearchModal';
import {EditSavedSearchModal} from 'sentry/components/modals/savedSearchModal/editSavedSearchModal';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch, SavedSearchVisibility} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useDeleteSavedSearchOptimistic} from 'sentry/views/issueList/mutations/useDeleteSavedSearch';
import {useFetchSavedSearchesForOrg} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

interface SavedIssueSearchesProps {
  isOpen: boolean;
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  organization: Organization;
  query: string;
  sort: string;
}

interface SavedSearchItemProps
  extends Pick<SavedIssueSearchesProps, 'organization' | 'onSavedSearchSelect'> {
  savedSearch: SavedSearch;
}

type CreateNewSavedSearchButtonProps = Pick<
  SavedIssueSearchesProps,
  'query' | 'sort' | 'organization'
>;

const MAX_SHOWN_SEARCHES = 4;

const SavedSearchItemDescription = ({
  savedSearch,
}: Pick<SavedSearchItemProps, 'savedSearch'>) => {
  if (savedSearch.isGlobal) {
    return <SavedSearchItemQuery>{savedSearch.query}</SavedSearchItemQuery>;
  }

  return (
    <SavedSearchItemVisbility>
      {savedSearch.visibility === SavedSearchVisibility.Organization
        ? t('Anyone in organization can see but not edit')
        : t('Only you can see and edit')}
    </SavedSearchItemVisbility>
  );
};

const SavedSearchItem = ({
  organization,
  onSavedSearchSelect,
  savedSearch,
}: SavedSearchItemProps) => {
  const {mutate: deleteSavedSearch} = useDeleteSavedSearchOptimistic();
  const hasOrgWriteAccess = organization.access?.includes('org:write');

  const canEdit =
    savedSearch.visibility === SavedSearchVisibility.Owner || hasOrgWriteAccess;

  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: 'Edit',
      disabled: !canEdit,
      details: !canEdit
        ? t('You do not have permission to edit this search.')
        : undefined,
      onAction: () => {
        openModal(deps => (
          <EditSavedSearchModal {...deps} {...{organization, savedSearch}} />
        ));
      },
    },
    {
      disabled: !canEdit,
      details: !canEdit
        ? t('You do not have permission to delete this search.')
        : undefined,
      key: 'delete',
      label: t('Delete'),
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to delete this saved search?'),
          onConfirm: () =>
            deleteSavedSearch({orgSlug: organization.slug, id: savedSearch.id}),
        });
      },
      priority: 'danger',
    },
  ];

  return (
    <SearchListItem hasMenu={!savedSearch.isGlobal}>
      <StyledItemButton
        aria-label={savedSearch.name}
        onClick={() => onSavedSearchSelect(savedSearch)}
        borderless
        align="left"
      >
        <TitleDescriptionWrapper>
          <SavedSearchItemTitle>{savedSearch.name}</SavedSearchItemTitle>
          <SavedSearchItemDescription savedSearch={savedSearch} />
        </TitleDescriptionWrapper>
      </StyledItemButton>
      {!savedSearch.isGlobal && (
        <OverflowMenu
          position="bottom-end"
          items={actions}
          size="sm"
          minMenuWidth={200}
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
      aria-label={t('Create a new saved search')}
      onClick={onClick}
      icon={<IconAdd size="sm" />}
      borderless
      size="sm"
    />
  );
}

const SavedIssueSearchesContent = ({
  organization,
  isOpen,
  onSavedSearchSelect,
  query,
  sort,
}: SavedIssueSearchesProps) => {
  const [showAll, setShowAll] = useState(false);
  const {
    data: savedSearches,
    isLoading,
    isError,
    refetch,
  } = useFetchSavedSearchesForOrg(
    {orgSlug: organization.slug},
    {enabled: organization.features.includes('issue-list-saved-searches-v2')}
  );

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    return (
      <StyledSidebar>
        <LoadingIndicator />
      </StyledSidebar>
    );
  }

  if (isError) {
    return (
      <StyledSidebar>
        <LoadingError onRetry={refetch} />
      </StyledSidebar>
    );
  }

  const orgSavedSearches = orderBy(
    savedSearches.filter(search => !search.isGlobal && !search.isPinned),
    'dateCreated',
    'desc'
  );

  const recommendedSavedSearches = savedSearches.filter(search => search.isGlobal);

  const shownOrgSavedSearches = showAll
    ? orgSavedSearches
    : orgSavedSearches.slice(0, MAX_SHOWN_SEARCHES);

  return (
    <StyledSidebar>
      <Fragment>
        <HeadingContainer>
          <Heading>{t('Saved Searches')}</Heading>
          <CreateNewSavedSearchButton {...{organization, query, sort}} />
        </HeadingContainer>
        <SearchesContainer>
          {shownOrgSavedSearches.map(item => (
            <SavedSearchItem
              key={item.id}
              organization={organization}
              onSavedSearchSelect={onSavedSearchSelect}
              savedSearch={item}
            />
          ))}
          {shownOrgSavedSearches.length === 0 && (
            <NoSavedSearchesText>
              {t("You don't have any saved searches")}
            </NoSavedSearchesText>
          )}
        </SearchesContainer>
        {orgSavedSearches.length > shownOrgSavedSearches.length && (
          <ShowAllButton size="zero" borderless onClick={() => setShowAll(true)}>
            {t(
              'Show %s more',
              (orgSavedSearches.length - shownOrgSavedSearches.length).toLocaleString()
            )}
          </ShowAllButton>
        )}
      </Fragment>
      {recommendedSavedSearches.length > 0 && (
        <Fragment>
          <HeadingContainer>
            <Heading>{t('Recommended Searches')}</Heading>
          </HeadingContainer>
          <SearchesContainer>
            {recommendedSavedSearches.map(item => (
              <SavedSearchItem
                key={item.id}
                organization={organization}
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

const SavedIssueSearches = (props: SavedIssueSearchesProps) => {
  if (!props.organization.features.includes('issue-list-saved-searches-v2')) {
    return null;
  }

  return <SavedIssueSearchesContent {...props} />;
};

const StyledSidebar = styled('aside')`
  grid-area: saved-searches;
  width: 100%;
  padding: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    border-bottom: 1px solid ${p => p.theme.gray200};
    padding: ${space(2)} 0;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    border-left: 1px solid ${p => p.theme.gray200};
    max-width: 340px;
  }
`;

const HeadingContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 38px;
  padding-left: ${space(2)};
  margin-top: ${space(3)};

  &:first-of-type {
    margin-top: 0;
  }
`;

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;

const SearchesContainer = styled('ul')`
  padding: 0;
  margin-bottom: ${space(1)};
`;

const StyledItemButton = styled(Button)`
  display: block;
  width: 100%;
  text-align: left;
  height: auto;
  font-weight: normal;
  line-height: ${p => p.theme.text.lineHeightBody};

  padding: ${space(1)} ${space(2)};
`;

const OverflowMenu = styled(DropdownMenuControl)`
  position: absolute;
  top: 12px;
  right: ${space(1)};
`;

const SearchListItem = styled('li')<{hasMenu?: boolean}>`
  position: relative;
  list-style: none;
  padding: 0;
  margin: 0;

  ${p =>
    p.hasMenu &&
    css`
      @media (max-width: ${p.theme.breakpoints.small}) {
        ${StyledItemButton} {
          padding-right: 60px;
        }
      }

      @media (min-width: ${p.theme.breakpoints.small}) {
        ${OverflowMenu} {
          display: none;
        }

        &:hover,
        &:focus-within {
          ${OverflowMenu} {
            display: block;
          }

          ${StyledItemButton} {
            padding-right: 60px;
          }
        }
      }
    `}
`;

const TitleDescriptionWrapper = styled('div')`
  overflow: hidden;
`;

const SavedSearchItemTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  ${p => p.theme.overflowEllipsis}
`;

const SavedSearchItemVisbility = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis}
`;

const SavedSearchItemQuery = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis}
`;

const ShowAllButton = styled(Button)`
  color: ${p => p.theme.linkColor};
  font-weight: normal;
  padding: ${space(0.5)} ${space(2)};

  &:hover {
    color: ${p => p.theme.linkHoverColor};
  }
`;

const NoSavedSearchesText = styled('p')`
  padding: 0 ${space(2)};
  margin: ${space(0.5)} 0;
  color: ${p => p.theme.subText};
`;

export default SavedIssueSearches;
