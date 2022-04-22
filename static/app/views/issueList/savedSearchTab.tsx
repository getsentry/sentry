import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DropdownButtonV2 from 'sentry/components/dropdownButtonV2';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import QueryCount from 'sentry/components/queryCount';
import Tooltip from 'sentry/components/tooltip';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';
import {defined} from 'sentry/utils';

import {getSortLabel} from './utils';

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

  const savedSearches = savedSearchList.filter(search => !search.isGlobal);
  const globalSearches = savedSearchList.filter(
    search => search.isGlobal && !search.isPinned && search.query !== 'is:unresolved'
  );

  function getSearchItem(search, keyPrefix) {
    return {
      key: `${keyPrefix}-${search.id}`,
      label: search.name,
      details: (
        <Tooltip
          title={
            <Fragment>
              {`${search.name} \u2022 `}
              <TooltipSearchQuery>{search.query}</TooltipSearchQuery>
              {` \u2022 `}
              {t('Sort: ')}
              {getSortLabel(search.sort)}
            </Fragment>
          }
          containerDisplayMode="block"
          delay={1000}
        >
          <Details>
            {search.query}
            {` \u2022 ${t('Sort:')} ${getSortLabel(search.sort)}`}
          </Details>
        </Tooltip>
      ),
      ...(!search.isPinned &&
        !search.isGlobal && {
          trailingItems: (
            <Access
              organization={organization}
              access={['org:write']}
              renderNoAccessMessage={false}
            >
              <Confirm
                onConfirm={() => onSavedSearchDelete(search)}
                message={t('Are you sure you want to delete this saved search?')}
                stopPropagation
              >
                <DeleteButton
                  borderless
                  icon={<IconDelete />}
                  aria-label={t('delete')}
                  size="zero"
                />
              </Confirm>
            </Access>
          ),
        }),
      trailingItemsSpanFullHeight: true,
      onAction: () => onSavedSearchSelect(search),
    };
  }

  const menuItems = [
    ...(savedSearches.length > 0
      ? [
          {
            key: 'saved-searches',
            label: t('Saved Searches'),
            children: savedSearches.map(search => getSearchItem(search, 'saved-search')),
          },
        ]
      : []),
    ...(globalSearches.length > 0
      ? [
          {
            key: 'global-searches',
            label: t('Recommended Searches'),
            children: globalSearches.map(search =>
              getSearchItem(search, 'global-search')
            ),
          },
        ]
      : []),
  ];

  const trigger = ({props, ref}) => (
    <StyledDropdownTrigger
      ref={ref}
      {...props}
      isActive={isActive}
      borderless
      priority="link"
      size="zero"
    >
      {isActive ? (
        <Fragment>
          <span>{savedSearch ? savedSearch.name : t('Custom Search')}&nbsp;</span>
          {defined(queryCount) && queryCount > 0 && (
            <Badge>
              <QueryCount hideParens count={queryCount} max={1000} />
            </Badge>
          )}
        </Fragment>
      ) : (
        t('Saved Searches')
      )}
    </StyledDropdownTrigger>
  );

  return (
    <StyledDropdownControl
      renderWrapAs="li"
      trigger={trigger}
      items={menuItems}
      isActive={isActive}
      offset={-4}
      className="saved-search-tab"
      data-test-id="saved-search-tab"
    />
  );
}

export default SavedSearchTab;

const StyledDropdownControl = styled(DropdownMenuControlV2)<{isActive?: boolean}>`
  border-bottom-width: 4px;
  border-bottom-style: solid;
  border-bottom-color: ${p => (p.isActive ? p.theme.active : 'transparent')};
`;

const StyledDropdownTrigger = styled(DropdownButtonV2)<{isActive?: boolean}>`
  display: flex;
  height: calc(1.25rem - 2px);
  align-items: center;
  color: ${p => (p.isActive ? p.theme.textColor : p.theme.subText)};
  box-sizing: content-box;
  padding: ${space(1)} 0;

  &:hover {
    color: ${p => p.theme.textColor};
  }

  @media only screen and (max-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const Details = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  max-width: 16rem;
  ${overflowEllipsis}
`;

const TooltipSearchQuery = styled('span')`
  color: ${p => p.theme.subText};
  font-weight: normal;
  font-family: ${p => p.theme.text.familyMono};
`;

const DeleteButton = styled(Button)`
  color: ${p => p.theme.subText};
  background: transparent;
  flex-shrink: 0;
  padding: ${space(1)} 0;
  text-align: center;
  text-transform: capitalize;

  :hover {
    color: #2f2936;
    background: transparent;
    color: ${p => p.theme.error};
  }
`;
