import { Component } from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, SavedSearch} from 'app/types';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl from 'app/components/dropdownControl';
import Tooltip from 'app/components/tooltip';
import {IconDelete} from 'app/icons';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  organization: Organization;
  savedSearchList: SavedSearch[];
  onSavedSearchSelect: (savedSearch: SavedSearch) => void;
  onSavedSearchDelete: (savedSearch: SavedSearch) => void;
  searchId?: string;
  query?: string;
};

export default class SavedSearchSelector extends Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    savedSearchList: PropTypes.array.isRequired,
    onSavedSearchSelect: PropTypes.func.isRequired,
    onSavedSearchDelete: PropTypes.func.isRequired,
    searchId: PropTypes.string,
    query: PropTypes.string,
  };

  getTitle() {
    const {searchId, query, savedSearchList} = this.props;
    let result: SavedSearch | undefined;

    if (searchId) {
      result = savedSearchList.find(search => searchId === search.id);
    } else {
      result = savedSearchList.find(search => query === search.query);
    }

    return result ? result.name : t('Custom Search');
  }

  renderList() {
    const {
      savedSearchList,
      onSavedSearchDelete,
      onSavedSearchSelect,
      organization,
    } = this.props;

    if (savedSearchList.length === 0) {
      return <EmptyItem>{t("There don't seem to be any saved searches yet.")}</EmptyItem>;
    }

    return savedSearchList.map((search, index) => (
      <Tooltip
        title={
          <span>
            {`${search.name} \u2022 `}
            <TooltipSearchQuery>{search.query}</TooltipSearchQuery>
          </span>
        }
        containerDisplayMode="block"
        delay={1000}
        key={search.id}
      >
        <MenuItem last={index === savedSearchList.length - 1}>
          <MenuItemLink tabIndex={-1} onClick={() => onSavedSearchSelect(search)}>
            <SearchTitle>{search.name}</SearchTitle>
            <SearchQuery>{search.query}</SearchQuery>
          </MenuItemLink>
          {search.isGlobal === false && search.isPinned === false && (
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
                  title={t('Delete this saved search')}
                  icon={<IconDelete />}
                  label={t('delete')}
                  size="zero"
                />
              </Confirm>
            </Access>
          )}
        </MenuItem>
      </Tooltip>
    ));
  }

  render() {
    return (
      <Container>
        <DropdownControl
          menuWidth="35vw"
          blendWithActor
          button={({isOpen, getActorProps}) => (
            <StyledDropdownButton {...getActorProps()} isOpen={isOpen}>
              <ButtonTitle>{this.getTitle()}</ButtonTitle>
            </StyledDropdownButton>
          )}
        >
          {this.renderList()}
        </DropdownControl>
      </Container>
    );
  }
}

const Container = styled('div')`
  position: relative;
  display: block;
`;

const StyledDropdownButton = styled(DropdownButton)`
  border-right: 0;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  border-radius: ${p =>
    p.isOpen
      ? `${p.theme.borderRadius} 0 0 0`
      : `${p.theme.borderRadius} 0 0 ${p.theme.borderRadius}`};
  white-space: nowrap;
  max-width: 200px;

  &:hover,
  &:active {
    border-right: 0;
  }
`;

const ButtonTitle = styled('span')`
  ${overflowEllipsis}
`;

const SearchTitle = styled('strong')`
  color: ${p => p.theme.gray800};
  padding: 0;
  background: inherit;

  &:after {
    content: ' \u2022 ';
  }
`;

const SearchQuery = styled('code')`
  color: ${p => p.theme.gray800};
  padding: 0;
  background: inherit;
`;

const TooltipSearchQuery = styled('span')`
  color: ${p => p.theme.gray400};
  font-weight: normal;
  font-family: ${p => p.theme.text.familyMono};
`;

const DeleteButton = styled(Button)`
  color: ${p => p.theme.gray400};
  background: transparent;
  flex-shrink: 0;
  padding: ${space(1.5)} ${space(1.5)} ${space(1)} 0;

  &:hover {
    background: transparent;
    color: ${p => p.theme.blue300};
  }
`;

const MenuItem = styled('li')<{last: boolean}>`
  display: flex;

  position: relative;
  border-bottom: ${p => (!p.last ? `1px solid ${p.theme.borderLight}` : null)};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;

  & :hover {
    background: ${p => p.theme.gray100};
  }
`;

const MenuItemLink = styled('a')`
  display: block;
  flex-grow: 1;
  padding: ${space(1)} ${space(1.5)};

  ${overflowEllipsis}
`;

const EmptyItem = styled('li')`
  padding: 8px 10px 5px;
  font-style: italic;
`;
