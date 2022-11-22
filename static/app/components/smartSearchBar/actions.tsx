// eslint-disable-next-line no-restricted-imports
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {pinSearch, unpinSearch} from 'sentry/actionCreators/savedSearches';
import Button from 'sentry/components/button';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import {CreateSavedSearchModal} from 'sentry/components/modals/savedSearchModal/createSavedSearchModal';
import {IconAdd, IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SavedSearch, SavedSearchType} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';

import type {ActionBarItem, ActionProps} from './index';
import {removeSpace} from './utils';

type PinSearchActionOpts = {
  location: ReturnType<typeof useLocation>;
  /**
   * The current issue sort
   */
  sort: string;
  /**
   * The currently pinned search
   */
  pinnedSearch?: SavedSearch;
};

/**
 * The Pin Search action toggles the current as a pinned search
 */
export function makePinSearchAction({
  pinnedSearch,
  sort,
  location,
}: PinSearchActionOpts): ActionBarItem {
  const makeAction = ({api, organization, query, savedSearchType}: ActionProps) => {
    const onTogglePinnedSearch = async () => {
      if (savedSearchType === undefined) {
        return;
      }

      const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

      trackAdvancedAnalyticsEvent('search.pin', {
        organization,
        action: pinnedSearch ? 'unpin' : 'pin',
        search_type: savedSearchType === SavedSearchType.ISSUE ? 'issues' : 'events',
        query: pinnedSearch?.query ?? query,
      });

      if (pinnedSearch) {
        unpinSearch(api, organization.slug, savedSearchType, pinnedSearch).then(() => {
          browserHistory.push({
            ...location,
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {
              referrer: 'search-bar',
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
        query: {referrer: 'search-bar', ...currentQuery},
      });
    };

    const pinSearchMenuItem: MenuItemProps = {
      onAction: onTogglePinnedSearch,
      label: pinnedSearch ? t('Unpin Search') : t('Pin Search'),
      key: 'pinSearch',
    };

    const PinSearchActionButton = () => {
      const pinTooltip = pinnedSearch ? t('Unpin this search') : t('Pin this search');

      return (
        <ActionButton
          title={pinTooltip}
          disabled={!query}
          aria-label={pinTooltip}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();

            onTogglePinnedSearch();
          }}
          isActive={!!pinnedSearch}
          data-test-id="pin-icon"
          icon={<IconPin isSolid={!!pinnedSearch} size="xs" />}
        />
      );
    };

    return {Button: PinSearchActionButton, menuItem: pinSearchMenuItem};
  };

  return {key: 'pinSearch', makeAction};
}

type SaveSearchActionOpts = {
  disabled: boolean;
  /**
   * The current issue sort
   */
  sort: string;
};

/**
 * The Save Search action triggers the create saved search modal from the
 * current query.
 */
export function makeSaveSearchAction({
  sort,
  disabled,
}: SaveSearchActionOpts): ActionBarItem {
  const makeAction = ({query, organization}: ActionProps) => {
    const onSaveSearch = () => {
      trackAdvancedAnalyticsEvent('search.saved_search_open_create_modal', {
        organization,
      });
      openModal(deps => (
        <CreateSavedSearchModal {...deps} {...{organization, query, sort}} />
      ));
    };

    const title = disabled
      ? t('You do not have permission to create a saved search')
      : t('Add to organization saved searches');

    const menuItem: MenuItemProps = {
      disabled,
      onAction: onSaveSearch,
      label: t('Create Saved Search'),
      key: 'saveSearch',
      details: disabled ? title : undefined,
    };

    const SaveSearchActionButton = () => (
      <ActionButton
        onClick={onSaveSearch}
        disabled={disabled}
        icon={<IconAdd size="xs" />}
        title={title}
        aria-label={title}
        data-test-id="save-current-search"
      />
    );

    return {Button: SaveSearchActionButton, menuItem};
  };

  return {key: 'saveSearch', makeAction};
}

export const ActionButton = styled(Button)<{isActive?: boolean}>`
  color: ${p => (p.isActive ? p.theme.linkColor : p.theme.subText)};
  width: 18px;
  height: 18px;
  padding: 2px;
  min-height: auto;

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
