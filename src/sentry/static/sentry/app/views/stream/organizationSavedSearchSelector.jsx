import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import Modal from 'react-bootstrap/lib/Modal';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import MenuItem from 'app/components/menuItem';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu from 'app/components/dropdownMenu';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import {TextField} from 'app/components/forms';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {createSavedSearch} from 'app/actionCreators/savedSearches';
import overflowEllipsis from 'app/styles/overflowEllipsis';

export default class OrganizationSavedSearchSelector extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    savedSearchList: PropTypes.array.isRequired,
    onSavedSearchCreate: PropTypes.func.isRequired,
    onSavedSearchSelect: PropTypes.func.isRequired,
    onSavedSearchDelete: PropTypes.func.isRequired,
    query: PropTypes.string.isRequired,
    searchId: PropTypes.string,
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
      <StyledMenuItem onSelect={() => onSavedSearchSelect(search)} key={search.id}>
        {search.isPinned && <InlineSvg src="icon-pin" />}
        <SearchTitle>{search.name}</SearchTitle>
        <SearchQuery>{search.query}</SearchQuery>
        {search.isGlobal === false && (
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
      </StyledMenuItem>
    ));
  }

  render() {
    const {organization, query, onSavedSearchCreate} = this.props;

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
                  <Access
                    organization={organization}
                    access={['org:write']}
                    renderNoAccessMessage={false}
                  >
                    <StyledMenuItem divider={true} />
                    <ButtonBar>
                      <SaveSearchButton
                        query={query}
                        organization={organization}
                        onSave={onSavedSearchCreate}
                      />
                    </ButtonBar>
                  </Access>
                </MenuContainer>
              </React.Fragment>
            );
          }}
        </DropdownMenu>
      </Container>
    );
  }
}

const SaveSearchButton = withApi(
  class SaveSearchButton extends React.Component {
    static propTypes = {
      api: PropTypes.object.isRequired,
      query: PropTypes.string.isRequired,
      organization: SentryTypes.Organization.isRequired,
      onSave: PropTypes.func.isRequired,
    };

    constructor(props) {
      super(props);
      this.state = {
        isModalOpen: false,
        isSaving: false,
        query: props.query,
        name: '',
        error: null,
      };
    }

    onSubmit = e => {
      const {api, organization, onSave} = this.props;

      e.preventDefault();

      this.setState({isSaving: true});

      addLoadingMessage(t('Saving Changes'));

      createSavedSearch(api, organization.slug, this.state.name, this.state.query)
        .then(data => {
          onSave(data);
          this.onToggle();
          this.setState({
            error: null,
            isSaving: false,
          });
          clearIndicators();
        })
        .catch(err => {
          let error = t('Unable to save your changes.');
          if (err.responseJSON && err.responseJSON.detail) {
            error = err.responseJSON.detail;
          }
          this.setState({
            error,
            isSaving: false,
          });
          clearIndicators();
        });
    };

    onToggle = event => {
      this.setState({
        isModalOpen: !this.state.isModalOpen,
      });

      if (event) {
        event.stopPropagation();
      }
    };

    handleChangeName = val => {
      this.setState({name: val});
    };

    handleChangeQuery = val => {
      this.setState({query: val});
    };

    render() {
      const {isSaving, isModalOpen} = this.state;

      return (
        <React.Fragment>
          <Button
            size="xsmall"
            onClick={this.onToggle}
            data-test-id="save-current-search"
          >
            {t('Save Current Search')}
          </Button>
          <Modal show={isModalOpen} animation={false} onHide={this.onToggle}>
            <form onSubmit={this.onSubmit}>
              <div className="modal-header">
                <h4>{t('Save Current Search')}</h4>
              </div>

              <div className="modal-body">
                {this.state.error && (
                  <div className="alert alert-error alert-block">{this.state.error}</div>
                )}

                <p>{t('All team members will now have access to this search.')}</p>
                <TextField
                  key="name"
                  name="name"
                  label={t('Name')}
                  placeholder="e.g. My Search Results"
                  required={true}
                  onChange={this.handleChangeName}
                />
                <TextField
                  key="query"
                  name="query"
                  label={t('Query')}
                  value={this.props.query}
                  required={true}
                  onChange={this.handleChangeQuery}
                />
              </div>
              <div className="modal-footer">
                <Button
                  priority="default"
                  size="small"
                  disabled={isSaving}
                  onClick={this.onToggle}
                  style={{marginRight: space(1)}}
                >
                  {t('Cancel')}
                </Button>
                <Button priority="primary" size="small" disabled={isSaving}>
                  {t('Save')}
                </Button>
              </div>
            </form>
          </Modal>
        </React.Fragment>
      );
    }
  }
);

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
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  color: ${p => p.theme.gray5};
  padding: 0;
  background: inherit;
`;

const DeleteButton = styled(Button)`
  color: ${p => p.theme.gray1};
  background: ${p => p.theme.offWhite};
  display: none;
  position: absolute;

  /* Rows are 20px tall */
  top: 10px;
  right: 10px;

  &:hover {
    color: ${p => p.theme.blueLight};
  }
`;

const StyledMenuItem = styled(MenuItem)`
  position: relative;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;

  &:focus ${DeleteButton}, &:hover ${DeleteButton} {
    display: block;
  }

  &:last-child {
    border-bottom: 0;
  }

  & a {
    display: block;
    padding: ${space(1)} ${space(1.5)};

    & :hover {
      background: ${p => p.theme.offWhite};
    }
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

const ButtonBar = styled.li`
  padding: ${space(0.5)} ${space(1)};
  display: flex;
  justify-content: space-between;

  & a {
    /* need to override .dropdown-menu li a in shared-components.less */
    padding: 0 !important;
    line-height: 1 !important;
  }
`;
