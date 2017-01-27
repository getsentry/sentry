import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import {Link} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../../components/dropdownLink';
import IndicatorStore from '../../stores/indicatorStore';
import MenuItem from '../../components/menuItem';
import {t} from '../../locale';
import {BooleanField, TextField} from '../../components/forms';

const SaveSearchState = {
  READY: 'Ready',
  SAVING: 'Saving',
  ERROR: 'Error',
};

const SaveSearchButton = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,

    query: React.PropTypes.string.isRequired,
    disabled: React.PropTypes.bool,
    style: React.PropTypes.object,
    tooltip: React.PropTypes.string,
    buttonTitle: React.PropTypes.string,

    onSave: React.PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      isModalOpen: false,
      state: SaveSearchState.READY,
      formData: {
        query: this.props.query,
      },
    };
  },

  onToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen,
      state: SaveSearchState.READY,
      formData: {
        query: this.props.query,
      },
    });
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData,
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

    if (this.state.state == SaveSearchState.SAVING) {
      return;
    }
    this.setState({
      state: SaveSearchState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      let {orgId, projectId} = this.props;
      this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
        method: 'POST',
        data: this.state.formData,
        success: (data) => {
          this.onToggle();
          this.props.onSave(data);
        },
        complete: () => {
          this.setState({state: SaveSearchState.ERROR});
          IndicatorStore.remove(loadingIndicator);
        },
      });
    });
  },

  render() {
    let isSaving = this.state.state === SaveSearchState.SAVING;
    return (
      <a title={this.props.tooltip || this.props.buttonTitle}
         className={this.props.className}
         disabled={this.props.disabled}
         onClick={this.onToggle}
         style={this.props.style}>
        {this.props.children}

        <Modal show={this.state.isModalOpen}
               animation={false}
               onHide={this.onToggle}>
          <form onSubmit={this.onSubmit}>
            <div className="modal-header">
              <h4>{t('Save Current Search')}</h4>
            </div>
            <div className="modal-body">
              <p>{t('Saving this search will give you and your team quick access to it in the future.')}</p>
              <TextField
                key="name"
                name="name"
                label={t('Name')}
                placeholder="e.g. My Search Results"
                required={true}
                onChange={this.onFieldChange.bind(this, 'name')} />
              <TextField
                key="query"
                name="query"
                label={t('Query')}
                value={this.state.formData.query}
                required={true}
                onChange={this.onFieldChange.bind(this, 'query')} />
              <BooleanField
                key="isUserDefault"
                name="is-user-default"
                label={t('Make this the default view for myself.')}
                onChange={this.onFieldChange.bind(this, 'isUserDefault')} />
              <BooleanField
                key="isDefault"
                name="is-default"
                label={t('Make this the default view for my team.')}
                onChange={this.onFieldChange.bind(this, 'isDefault')} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default"
                      disabled={isSaving}
                      onClick={this.onToggle}>{t('Cancel')}</button>
              <button type="submit" className="btn btn-primary"
                      disabled={isSaving}>{t('Save')}</button>
            </div>
          </form>
        </Modal>
      </a>
    );
  }
});

const SavedSearchSelector = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    searchId: React.PropTypes.string,
    access: React.PropTypes.object.isRequired,
    savedSearchList: React.PropTypes.array.isRequired,
    onSavedSearchCreate: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  getTitle() {
    let searchId = this.props.searchId || null;
    if (!searchId) return t('Custom Search');
    let results = this.props.savedSearchList.filter((search) => {
      return searchId === search.id;
    });
    return results.length ? results[0].name : t('Custom Search');
  },

  render() {
    let {access, orgId, projectId} = this.props;
    let children = this.props.savedSearchList.map((search) => {
      // TODO(dcramer): we want these to link directly to the saved
      // search ID, and pass that into the backend (probably)
      return (
        <MenuItem to={`/${orgId}/${projectId}/searches/${search.id}/`}
                  key={search.id}>
          <strong>{search.name}</strong>
          <code>{search.query}</code>
        </MenuItem>
      );
    });
    return (
      <div className="saved-search-selector">
        <DropdownLink title={this.getTitle()}>
          {children.length ?
            children
          :
            <li className="empty">{t('There don\'t seem to be any saved searches yet.')}</li>
          }
          {access.has('project:write') &&
            <MenuItem divider={true} />
          }
          {access.has('project:write') &&
            <li>
              <div className="row">
                <div className="col-md-7">
                  <SaveSearchButton
                      className="btn btn-sm btn-default"
                      onSave={this.props.onSavedSearchCreate}
                      {...this.props}>{t('Save Current Search')}</SaveSearchButton>
                </div>
                <div className="col-md-5">
                  <Link
                    to={`/${orgId}/${projectId}/settings/saved-searches/`}
                    className="btn btn-sm btn-default">{t('Manage')}</Link>
                </div>
              </div>
            </li>
          }
        </DropdownLink>
      </div>
    );
  }
});

export default SavedSearchSelector;
