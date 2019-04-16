import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu from 'app/components/dropdownMenu';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

export default class OrganizationSavedSearchSelector extends React.Component {
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
    let result;

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

    return savedSearchList.map(search => (
      <MenuItem key={search.id}>
        <a tabIndex="-1" onClick={() => onSavedSearchSelect(search)}>
          <SearchTitle>{search.name}</SearchTitle>
          <SearchQuery>{search.query}</SearchQuery>
        </a>
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
                icon="icon-trash"
                size="zero"
              />
            </Confirm>
          </Access>
        )}
      </MenuItem>
    ));
  }

  render() {
    return (
      <Container>
        <DropdownMenu alwaysRenderMenu={true}>
          {({isOpen, getMenuProps, getActorProps}) => {
            return (
              <React.Fragment>
                <StyledDropdownButton
                  {...getActorProps({isStyled: true})}
                  isOpen={isOpen}
                >
                  <ButtonTitle>{this.getTitle()}</ButtonTitle>
                </StyledDropdownButton>
                <MenuContainer {...getMenuProps({isStyled: true})} isOpen={isOpen}>
                  {this.renderList()}
                </MenuContainer>
              </React.Fragment>
            );
          }}
        </DropdownMenu>
      </Container>
    );
  }
}

const Container = styled.div`
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

  /* Hack but search input, and sort dropdown are not standard size buttons */
  & > span {
    padding: 11px 16px;
  }
`;

const ButtonTitle = styled.span`
  ${overflowEllipsis}
`;

const SearchTitle = styled.strong`
  color: ${p => p.theme.gray5};
  padding: 0;
  background: inherit;

  &:after {
    content: ' \u2022 ';
  }
`;

const SearchQuery = styled.code`
  color: ${p => p.theme.gray5};
  padding: 0;
  background: inherit;
`;

const DeleteButton = styled(Button)`
  color: ${p => p.theme.gray1};
  background: transparent;
  flex-shrink: 0;
  padding: ${space(1)} ${space(1.5)} ${space(1)} 0;

  &:hover {
    background: transparent;
    color: ${p => p.theme.blueLight};
  }
`;

const MenuItem = styled.li`
  display: flex;

  position: relative;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;

  &:last-child {
    border-bottom: 0;
  }
  & :hover {
    background: ${p => p.theme.offWhite};
  }

  & a {
    display: block;
    flex-grow: 1;
    padding: ${space(1)} ${space(1.5)};
  }
`;

const MenuContainer = styled.ul`
  list-style: none;
  width: 375px;

  position: absolute;
  /* Buttons are 38px tall, this has to be -1 to get button overlapping the menu */
  top: 37px;
  padding: 0;
  margin: 0;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  background: ${p => p.theme.background};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  box-shadow: 0 1px 3px rgba(70, 82, 98, 0.25);
  border: 1px solid ${p => p.theme.borderDark};
  background-clip: padding-box;

  display: ${p => (p.isOpen ? 'block' : 'none')};
`;

const EmptyItem = styled.li`
  padding: 8px 10px 5px;
  font-style: italic;
`;
