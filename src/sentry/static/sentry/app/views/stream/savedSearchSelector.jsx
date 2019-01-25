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
      let formData = this.state.formData;
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
      let {api} = this.props;

      this.setState(
        {
          state: FormState.SAVING,
        },
        () => {
          let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
          let {orgId, projectId} = this.props;
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
      let isSaving = this.state.state === FormState.SAVING;
      let {tooltip, buttonTitle, style, children, disabled} = this.props;
      return (
        <React.Fragment>
          <Tooltip
            title="You must select issues from a single project to create new saved searches"
            disabled={!disabled}
          >
            <span>
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
            </span>
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
      savedSearchList: PropTypes.array.isRequired,
      queryCount: PropTypes.number,
      queryMaxCount: PropTypes.number,
      onSavedSearchCreate: PropTypes.func.isRequired,
    };

    getTitle() {
      let searchId = this.props.searchId || null;
      if (!searchId) return t('Custom Search');
      let results = this.props.savedSearchList.filter(search => {
        return searchId === search.id;
      });
      return results.length ? results[0].name : t('Custom Search');
    }

    render() {
      let {orgId, projectId, queryCount, queryMaxCount} = this.props;
      let hasProject = !!projectId;

      let children = this.props.savedSearchList.map(search => {
        let url = hasProject
          ? `/${orgId}/${projectId}/searches/${search.id}/`
          : `/organizations/${orgId}/issues/searches/${search.id}/`;

        return (
          <StyledMenuItem to={url} key={search.id}>
            <strong>{search.name}</strong>
            <code>{search.query}</code>
          </StyledMenuItem>
        );
      });
      return (
        <div className="saved-search-selector">
          <DropdownLink
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
                <span>
                  <Button
                    size="xsmall"
                    priority="default"
                    to={`/${orgId}/${projectId}/settings/saved-searches/`}
                    disabled={!hasProject}
                  >
                    {t('Manage')}
                  </Button>
                </span>
              </Tooltip>
            </ButtonBar>
          </DropdownLink>
        </div>
      );
    }
  }
);

const EmptyItem = styled.li`
  padding: 8px 10px 5px;
  font-style: italic;
`;

const StyledMenuItem = styled(MenuItem)`
  & a {
    padding: ${space(0.5)} ${space(1)};
  }
  & strong,
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
