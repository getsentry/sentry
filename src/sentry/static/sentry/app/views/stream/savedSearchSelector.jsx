import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import IndicatorStore from 'app/stores/indicatorStore';
import DropdownLink from 'app/components/dropdownLink';
import QueryCount from 'app/components/queryCount';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import Tag from 'app/views/settings/components/tag';
import {BooleanField, FormState, TextField} from 'app/components/forms';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';

const SaveSearchButton = withApi(
  class SaveSearchButton extends React.Component {
    static propTypes = {
      orgId: PropTypes.string.isRequired,
      projectId: PropTypes.string,
      access: PropTypes.object.isRequired,
      api: PropTypes.object.isRequired,
      query: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
      style: PropTypes.object,
      tooltip: PropTypes.string,
      buttonTitle: PropTypes.string,

      onSave: PropTypes.func.isRequired,
    };

    constructor(props) {
      super(props);
      this.state = {
        isModalOpen: false,
        formData: {
          query: this.props.query,
        },
        errors: {},
      };
    }

    onToggle() {
      if (this.props.disabled) {
        return;
      }
      this.setState({
        isModalOpen: !this.state.isModalOpen,
        state: FormState.READY,
        formData: {
          query: this.props.query,
        },
      });
    }

    onFieldChange(name, value) {
      const formData = this.state.formData;
      formData[name] = value;
      this.setState({
        formData,
      });
    }

    onDefaultChange(e) {
      this.onFieldChange('isDefault', e.target.checked);
    }

    onUserDefaultChange(e) {
      this.onFieldChange('isUserDefault', e.target.checked);
    }

    onSubmit(e) {
      e.preventDefault();

      if (this.state.state == FormState.SAVING) {
        return;
      }
      const {api} = this.props;

      this.setState(
        {
          state: FormState.SAVING,
        },
        () => {
          const loadingIndicator = IndicatorStore.add(t('Saving changes..'));
          const {orgId, projectId} = this.props;
          api.request(`/projects/${orgId}/${projectId}/searches/`, {
            method: 'POST',
            data: this.state.formData,
            success: data => {
              this.onToggle();
              this.props.onSave(data);
              this.setState({
                state: FormState.READY,
                errors: {},
              });
            },
            error: err => {
              let errors = err.responseJSON || true;
              errors = errors.detail || true;
              this.setState({
                state: FormState.ERROR,
                errors,
              });
            },
            complete: () => {
              IndicatorStore.remove(loadingIndicator);
            },
          });
        }
      );
    }

    render() {
      const isSaving = this.state.state === FormState.SAVING;
      const {tooltip, buttonTitle, style, children, disabled} = this.props;
      return (
        <React.Fragment>
          <Tooltip
            title="You must select issues from a single project to create new saved searches"
            disabled={!disabled}
          >
            <Button
              title={tooltip || buttonTitle}
              size="xsmall"
              priority="default"
              disabled={disabled}
              onClick={this.onToggle.bind(this)}
              style={style}
            >
              {children}
            </Button>
          </Tooltip>
          <Modal
            show={this.state.isModalOpen}
            animation={false}
            onHide={this.onToggle.bind(this)}
          >
            <form onSubmit={this.onSubmit.bind(this)}>
              <div className="modal-header">
                <h4>{t('Save Current Search')}</h4>
              </div>
              <div className="modal-body">
                {this.state.state === FormState.ERROR && (
                  <div className="alert alert-error alert-block">
                    {t(`Unable to save your changes. ${this.state.errors}`)}
                  </div>
                )}
                <p>
                  {t(
                    'Saving this search will give you and your team quick access to it in the future.'
                  )}
                </p>
                <TextField
                  key="name"
                  name="name"
                  label={t('Name')}
                  placeholder="e.g. My Search Results"
                  required={true}
                  onChange={this.onFieldChange.bind(this, 'name')}
                />
                <TextField
                  key="query"
                  name="query"
                  label={t('Query')}
                  value={this.state.formData.query}
                  required={true}
                  onChange={this.onFieldChange.bind(this, 'query')}
                />
                <BooleanField
                  key="isUserDefault"
                  name="is-user-default"
                  label={t('Make this the default view for myself.')}
                  onChange={this.onFieldChange.bind(this, 'isUserDefault')}
                />
                {this.props.access.has('project:write') && (
                  <BooleanField
                    key="isDefault"
                    name="is-default"
                    label={t('Make this the default view for my team.')}
                    onChange={this.onFieldChange.bind(this, 'isDefault')}
                  />
                )}
              </div>
              <div className="modal-footer">
                <Button
                  priority="default"
                  size="small"
                  disabled={isSaving}
                  onClick={this.onToggle.bind(this)}
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

const SavedSearchSelector = withApi(
  class SavedSearchSelector extends React.Component {
    static propTypes = {
      orgId: PropTypes.string.isRequired,
      projectId: PropTypes.string,
      searchId: PropTypes.string,
      access: PropTypes.object.isRequired,
      query: PropTypes.string,
      savedSearchList: PropTypes.array.isRequired,
      queryCount: PropTypes.number,
      queryMaxCount: PropTypes.number,
      onSavedSearchCreate: PropTypes.func.isRequired,
      onSavedSearchSelect: PropTypes.func.isRequired,
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

    render() {
      const {
        orgId,
        projectId,
        queryCount,
        queryMaxCount,
        onSavedSearchSelect,
      } = this.props;
      const hasProject = !!projectId;

      const children = this.props.savedSearchList.map(search => {
        return (
          <StyledMenuItem onSelect={() => onSavedSearchSelect(search)} key={search.id}>
            <span>
              <strong>{search.name}</strong>
              {search.projectSlug && <StyledTag>{search.projectSlug}</StyledTag>}
            </span>
            <code>{search.query}</code>
          </StyledMenuItem>
        );
      });
      return (
        <Container>
          <StyledDropdownLink
            title={
              <span>
                <span>{this.getTitle()}</span>
                <QueryCount count={queryCount} max={queryMaxCount} />
              </span>
            }
          >
            {children.length ? (
              children
            ) : (
              <EmptyItem>{t("There don't seem to be any saved searches yet.")}</EmptyItem>
            )}
            <StyledMenuItem divider={true} />
            <ButtonBar>
              <SaveSearchButton
                className="btn btn-sm btn-default"
                onSave={this.props.onSavedSearchCreate}
                disabled={!hasProject}
                {...this.props}
              >
                {t('Save Current Search')}
              </SaveSearchButton>

              <Tooltip
                title="You must select issues from a single project to manage saved searches"
                disabled={hasProject}
              >
                <Button
                  size="xsmall"
                  priority="default"
                  to={`/${orgId}/${projectId}/settings/saved-searches/`}
                  disabled={!hasProject}
                >
                  {t('Manage')}
                </Button>
              </Tooltip>
            </ButtonBar>
          </StyledDropdownLink>
        </Container>
      );
    }
  }
);

const Container = styled.div`
  & .dropdown-menu {
    max-width: 350px;
    min-width: 275px;
  }
`;

const StyledDropdownLink = styled(DropdownLink)`
  display: inline-block;
  font-size: 22px;
  color: ${p => p.theme.gray5};
  line-height: 36px;
  margin-right: 10px;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;

  & :hover,
  & :focus {
    color: ${p => p.theme.gray5};
  }

  & .icon-arrow-down {
    display: inline-block;
    margin-left: 5px;
    top: 0;
    vertical-align: middle;
  }
`;

const EmptyItem = styled.li`
  padding: 8px 10px 5px;
  font-style: italic;
`;

const StyledTag = styled(Tag)`
  display: inline-block;
  margin-left: ${space(0.25)};
`;

const StyledMenuItem = styled(MenuItem)`
  & a {
    /* override shared-components.less */
    padding: ${space(0.25)} ${space(1)} !important;
  }
  & span,
  & code {
    display: block;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    color: ${p => p.theme.gray5};
    padding: 0;
    background: inherit;
  }
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

export default SavedSearchSelector;
