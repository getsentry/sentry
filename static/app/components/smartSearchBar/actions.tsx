import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import {pinSearch, unpinSearch} from 'app/actionCreators/savedSearches';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import MenuItem from 'app/components/menuItem';
import {IconAdd, IconPin, IconSliders} from 'app/icons';
import {t} from 'app/locale';
import {SavedSearch, SavedSearchType} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import CreateSavedSearchModal from 'app/views/issueList/createSavedSearchModal';

import SmartSearchBar from './index';
import {removeSpace} from './utils';

type SmartSearchBarProps = React.ComponentProps<typeof SmartSearchBar>;

type ActionItem = NonNullable<SmartSearchBarProps['actionBarItems']>[number];
type ActionProps = React.ComponentProps<ActionItem['Action']>;

type PinSearchActionOpts = {
  /**
   * The currently pinned search
   */
  pinnedSearch?: SavedSearch;
  /**
   * The current issue sort
   */
  sort: string;
};

/**
 * The Pin Search action toggles the current as a pinned search
 */
export function makePinSearchAction({pinnedSearch, sort}: PinSearchActionOpts) {
  const PinSearchAction = ({
    menuItemVariant,
    savedSearchType,
    organization,
    api,
    query,
    location,
  }: ActionProps & WithRouterProps) => {
    const onTogglePinnedSearch = async (evt: React.MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (savedSearchType === undefined) {
        return;
      }

      const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

      trackAnalyticsEvent({
        eventKey: 'search.pin',
        eventName: 'Search: Pin',
        organization_id: organization.id,
        action: !!pinnedSearch ? 'unpin' : 'pin',
        search_type: savedSearchType === SavedSearchType.ISSUE ? 'issues' : 'events',
        query: pinnedSearch?.query ?? query,
      });

      if (!!pinnedSearch) {
        unpinSearch(api, organization.slug, savedSearchType, pinnedSearch).then(() => {
          browserHistory.push({
            ...location,
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {
              ...currentQuery,
              query: pinnedSearch.query,
              sort: pinnedSearch.sort,
            },
          });
        });
        return;
      }

      const resp = await pinSearch(
        api,
        organization.slug,
        savedSearchType,
        removeSpace(query),
        sort
      );

      if (!resp || !resp.id) {
        return;
      }

      browserHistory.push({
        ...location,
        pathname: `/organizations/${organization.slug}/issues/searches/${resp.id}/`,
        query: currentQuery,
      });
    };

    const pinTooltip = !!pinnedSearch ? t('Unpin this search') : t('Pin this search');

    return menuItemVariant ? (
      <MenuItem
        withBorder
        data-test-id="pin-icon"
        icon={<IconPin isSolid={!!pinnedSearch} size="xs" />}
        onClick={onTogglePinnedSearch}
      >
        {!!pinnedSearch ? t('Unpin Search') : t('Pin Search')}
      </MenuItem>
    ) : (
      <ActionButton
        title={pinTooltip}
        disabled={!query}
        aria-label={pinTooltip}
        onClick={onTogglePinnedSearch}
        isActive={!!pinnedSearch}
        data-test-id="pin-icon"
        icon={<IconPin isSolid={!!pinnedSearch} size="xs" />}
      />
    );
  };

  return {key: 'pinSearch', Action: withRouter(PinSearchAction)};
}

type SaveSearchActionOpts = {
  /**
   * The current issue sort
   */
  sort: string;
};

/**
 * The Save Search action triggers the create saved search modal from the
 * current query.
 */
export function makeSaveSearchAction({sort}: SaveSearchActionOpts) {
  const SavedSearchAction = ({menuItemVariant, query, organization}: ActionProps) => {
    const onClick = () =>
      openModal(deps => (
        <CreateSavedSearchModal {...deps} {...{organization, query, sort}} />
      ));

    return (
      <Access organization={organization} access={['org:write']}>
        {menuItemVariant ? (
          <MenuItem withBorder icon={<IconAdd size="xs" />} onClick={onClick}>
            {t('Create Saved Search')}
          </MenuItem>
        ) : (
          <ActionButton
            onClick={onClick}
            data-test-id="save-current-search"
            icon={<IconAdd size="xs" />}
            title={t('Add to organization saved searches')}
            aria-label={t('Add to organization saved searches')}
          />
        )}
      </Access>
    );
  };

  return {key: 'saveSearch', Action: SavedSearchAction};
}

type SearchBuilderActionOpts = {
  onSidebarToggle: React.MouseEventHandler;
};

/**
 * The Search Builder action toggles the Issue Stream search builder
 */
export function makeSearchBuilderAction({onSidebarToggle}: SearchBuilderActionOpts) {
  const SearchBuilderAction = ({menuItemVariant}: ActionProps) =>
    menuItemVariant ? (
      <MenuItem withBorder icon={<IconSliders size="xs" />} onClick={onSidebarToggle}>
        {t('Toggle sidebar')}
      </MenuItem>
    ) : (
      <ActionButton
        title={t('Toggle search builder')}
        tooltipProps={{containerDisplayMode: 'inline-flex'}}
        aria-label={t('Toggle search builder')}
        onClick={onSidebarToggle}
        icon={<IconSliders size="xs" />}
      />
    );

  return {key: 'searchBuilder', Action: SearchBuilderAction};
}

export const ActionButton = styled(Button)<{isActive?: boolean}>`
  color: ${p => (p.isActive ? p.theme.blue300 : p.theme.gray300)};
  width: 18px;

  &,
  &:hover,
  &:focus {
    background: transparent;
  }

  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

ActionButton.defaultProps = {
  type: 'button',
  borderless: true,
  size: 'zero',
};
