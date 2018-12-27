import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Modal from 'react-bootstrap/lib/Modal';
import {Link} from 'react-router';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import IndicatorStore from 'app/stores/indicatorStore';
import DropdownLink from 'app/components/dropdownLink';
import QueryCount from 'app/components/queryCount';
import MenuItem from 'app/components/menuItem';
import {BooleanField, FormState, TextField} from 'app/components/forms';

const SaveSearchButton = createReactClass({
  displayName: 'SaveSearchButton',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    query: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    style: PropTypes.object,
    tooltip: PropTypes.string,
    buttonTitle: PropTypes.string,

    onSave: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      isModalOpen: false,
      formData: {
        query: this.props.query,
      },
      errors: {},
    };
  },

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
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData,
    });
  },

  onDefaultChange(e) {
    this.onFieldChange('isDefault', e.target.checked);
  },

  onUserDefaultChange(e) {
    this.onFieldChange('isUserDefault', e.target.checked);
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        let {orgId, projectId} = this.props;
        this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
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
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    return (
      <React.Fragment>
        <a
          title={this.props.tooltip || this.props.buttonTitle}
          className={this.props.className}
          disabled={this.props.disabled}
          onClick={this.onToggle}
          style={this.props.style}
        >
          {this.props.children}
        </a>
        <Modal show={this.state.isModalOpen} animation={false} onHide={this.onToggle}>
          <form onSubmit={this.onSubmit}>
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
              <button
                type="button"
                className="btn btn-default"
                disabled={isSaving}
                onClick={this.onToggle}
              >
                {t('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {t('Save')}
              </button>
            </div>
          </form>
        </Modal>
      </React.Fragment>
    );
  },
});

const SavedSearchSelector = createReactClass({
  displayName: 'SavedSearchSelector',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    searchId: PropTypes.string,
    access: PropTypes.object.isRequired,
    savedSearchList: PropTypes.array.isRequired,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,
    onSavedSearchCreate: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getTitle() {
    let searchId = this.props.searchId || null;
    if (!searchId) return t('Custom Search');
    let results = this.props.savedSearchList.filter(search => {
      return searchId === search.id;
    });
    return results.length ? results[0].name : t('Custom Search');
  },

  render() {
    let {access, orgId, projectId, queryCount, queryMaxCount} = this.props;
    let children = this.props.savedSearchList.map(search => {
      // TODO(dcramer): we want these to link directly to the saved
      // search ID, and pass that into the backend (probably)
      return (
        <MenuItem to={`/${orgId}/${projectId}/searches/${search.id}/`} key={search.id}>
          <strong>{search.name}</strong>
          <code>{search.query}</code>
        </MenuItem>
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
            <li className="empty">
              {t("There don't seem to be any saved searches yet.")}
            </li>
          )}
          {access.has('project:write') && <MenuItem divider={true} />}
          <li>
            <div className="row">
              <div className="col-md-7">
                <SaveSearchButton
                  className="btn btn-sm btn-default"
                  onSave={this.props.onSavedSearchCreate}
                  {...this.props}
                >
                  {t('Save Current Search')}
                </SaveSearchButton>
              </div>
              <div className="col-md-5">
                <Link
                  to={`/${orgId}/${projectId}/settings/saved-searches/`}
                  className="btn btn-sm btn-default"
                >
                  {t('Manage')}
                </Link>
              </div>
            </div>
          </li>
        </DropdownLink>
      </div>
    );
  },
});

export default SavedSearchSelector;
