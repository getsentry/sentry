import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import {createSavedSearch} from 'app/actionCreators/savedSearches';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {TextField} from 'app/components/forms';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {IconAdd} from 'app/icons';

class CreateSavedSearchButton extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    buttonClassName: PropTypes.string,
    iconOnly: PropTypes.bool,
    withTooltip: PropTypes.bool,
    query: PropTypes.string.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  state = {
    isModalOpen: false,
    isSaving: false,
    name: '',
    error: null,
    query: null,
  };

  onSubmit = e => {
    const {api, organization} = this.props;
    const query = this.state.query || this.props.query;

    e.preventDefault();

    this.setState({isSaving: true});

    addLoadingMessage(t('Saving Changes'));

    createSavedSearch(api, organization.slug, this.state.name, query)
      .then(_data => {
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
    const newState = {
      isModalOpen: !this.state.isModalOpen,
    };
    if (newState.isModalOpen === false) {
      newState.name = '';
      newState.error = null;
      newState.query = null;
    }
    this.setState(newState);

    if (event) {
      event.preventDefault();
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
    const {isSaving, isModalOpen, error} = this.state;
    const {organization, query, buttonClassName, iconOnly, withTooltip} = this.props;

    return (
      <Access organization={organization} access={['org:write']}>
        <Button
          title={withTooltip ? t('Add to organization saved searches') : null}
          onClick={this.onToggle}
          data-test-id="save-current-search"
          size="zero"
          borderless
          containerDisplayMode="inline-flex"
          type="button"
          aria-label={t('Add to organization saved searches')}
          icon={<IconAdd size="xs" />}
          className={buttonClassName}
        >
          {!iconOnly && t('Create Saved Search')}
        </Button>
        <Modal show={isModalOpen} animation={false} onHide={this.onToggle}>
          <form onSubmit={this.onSubmit}>
            <div className="modal-header">
              <h4>{t('Save Current Search')}</h4>
            </div>

            <div className="modal-body">
              {this.state.error && (
                <div className="alert alert-error alert-block">{error}</div>
              )}

              <p>{t('All team members will now have access to this search.')}</p>
              <TextField
                key="name"
                name="name"
                label={t('Name')}
                placeholder="e.g. My Search Results"
                required
                onChange={this.handleChangeName}
              />
              <TextField
                key="query"
                name="query"
                label={t('Query')}
                value={query}
                required
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
      </Access>
    );
  }
}

export default withApi(CreateSavedSearchButton);
