import Modal from 'react-bootstrap/lib/Modal';
import PropTypes from 'prop-types';
import React from 'react';

import {FormState} from '../components/forms';
import {sortArray, parseRepo} from '../utils';
import {t, tct} from '../locale';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import DropdownReact from '../components/dropdownReact';
import IndicatorStore from '../stores/indicatorStore';
import MenuItem from '../components/menuItem';
import OrganizationSettingsView from './organizationSettingsView';
import PluginComponentBase from '../components/bases/pluginComponentBase';

const UNKNOWN_ERROR = {
  error_type: 'unknown',
};

class AddRepositoryLink extends PluginComponentBase {
  static propTypes = {
    provider: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);

    Object.assign(this.state, {
      ...this.getDefaultState(),
      fieldList: null,
      loading: true,
      state: FormState.LOADING,
    });

    ['onOpen', 'onCancel', 'formSubmit', 'changeField'].forEach(method => {
      this[method] = this[method].bind(this);
    });
  }

  getDefaultState() {
    return {
      isModalOpen: false,
      error: {},
      formData: {},
    };
  }

  onOpen() {
    this.setState({isModalOpen: true});
  }

  onCancel() {
    this.setState(this.getDefaultState());
  }

  formSubmit(ev) {
    // since this doesn't use the Form component, wrap onSubmit
    // in a function that calls preventDefault
    ev.preventDefault();
    this.onSubmit();
  }

  onSubmit() {
    // TODO(dcramer): set form saving state
    let formData = {
      ...this.state.formData,
      provider: this.props.provider.id,
    };
    if (formData.name) {
      formData.name = parseRepo(formData.name);
    }

    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        this.api.request(`/organizations/${this.props.orgId}/repos/`, {
          data: formData,
          method: 'POST',
          success: this.onSaveSuccess.bind(this, data => {
            this.setState({isModalOpen: false, formData: {}, error: {}});
            this.props.onSuccess(data);
          }),
          error: this.onSaveError.bind(this, error => {
            this.setState({
              error: error.responseJSON || UNKNOWN_ERROR || UNKNOWN_ERROR,
              state: FormState.error,
            });
          }),
          complete: this.onSaveComplete,
        });
      }
    );
  }

  changeField(name, value) {
    this.setState(state => ({
      formData: {
        ...state.formData,
        [name]: value,
      },
    }));
  }

  renderForm() {
    let errors = this.state.error.errors || {};
    let provider = this.props.provider;
    return (
      <form onSubmit={this.formSubmit}>
        {errors.__all__ && (
          <div className="alert alert-error alert-block" key="_errors">
            <p>{errors.__all__}</p>
          </div>
        )}
        {provider.config.map(field => {
          return (
            <div key={field.name}>
              {this.renderField({
                config: field,
                formData: this.state.formData,
                formErrors: errors,
                onChange: this.changeField.bind(this, field.name),
              })}
            </div>
          );
        })}
      </form>
    );
  }

  renderBody() {
    let error = this.state.error;
    if (error.error_type === 'auth') {
      let authUrl = error.auth_url;
      if (authUrl.indexOf('?') === -1) {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <div>
          <div className="alert alert-warning m-b-1">
            {'You need to associate an identity with ' +
              this.props.provider.name +
              ' before you can create issues with this service.'}
          </div>
          <a className="btn btn-primary" href={authUrl}>
            Associate Identity
          </a>
        </div>
      );
    } else if (error.error_type && error.error_type !== 'validation') {
      return (
        <div className="alert alert-error alert-block">
          <p>
            {error.message
              ? error.message
              : tct(
                  'An unknown error occurred. Need help with this? [link:Contact support]',
                  {
                    link: <a href="https://sentry.io/support/" />,
                  }
                )}
          </p>
        </div>
      );
    }
    return this.renderForm();
  }

  renderModal() {
    let {error, state} = this.state;
    return (
      <Modal show={this.state.isModalOpen} animation={false}>
        <div className="modal-header">
          <h4>{t('Add Repository')}</h4>
        </div>
        <div className="modal-body">{this.renderBody()}</div>
        {!error || error.error_type !== 'unknown' || error.message ? (
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-default"
              onClick={this.onCancel}
              disabled={state === FormState.SAVING}
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.onSubmit}
              disabled={state === FormState.SAVING}
            >
              {t('Save Changes')}
            </button>
          </div>
        ) : null}
      </Modal>
    );
  }

  render() {
    let provider = this.props.provider;
    return (
      <a onClick={this.onOpen}>
        {provider.name}
        {this.renderModal()}
      </a>
    );
  }
}

class OrganizationRepositories extends OrganizationSettingsView {
  getEndpoints() {
    let {orgId} = this.props.params;
    return [
      ['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}],
      ['repoConfig', `/organizations/${orgId}/config/repos/`],
    ];
  }

  deleteRepo = repo => {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${this.props.params.orgId}/repos/${repo.id}/`, {
      method: 'DELETE',
      success: data => {
        let itemList = this.state.itemList;
        itemList.forEach(item => {
          if (item.id === data.id) {
            item.status = data.status;
          }
        });
        this.setState({
          itemList,
        });
      },
      error: () => {
        IndicatorStore.add(t('An error occurred.'), 'error', {
          duration: 3000,
        });
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      },
    });
  };

  cancelDelete = repo => {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${this.props.params.orgId}/repos/${repo.id}/`, {
      method: 'PUT',
      data: {status: 'visible'},
      success: data => {
        let itemList = this.state.itemList;
        itemList.forEach(item => {
          if (item.id === data.id) {
            item.status = data.status;
          }
        });
        this.setState({
          itemList,
        });
      },
      error: () => {
        IndicatorStore.add(t('An error occurred.'), 'error', {
          duration: 3000,
        });
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      },
    });
  };

  onAddRepo = repo => {
    let itemList = this.state.itemList;
    itemList.push(repo);
    this.setState({
      itemList: sortArray(itemList, item => item.name),
    });
  };

  getStatusLabel(repo) {
    switch (repo.status) {
      case 'pending_deletion':
        return 'Deletion Queued';
      case 'deletion_in_progress':
        return 'Deletion in Progress';
      case 'hidden':
        return 'Disabled';
      default:
        return null;
    }
  }

  getTitle() {
    return 'Repositories';
  }

  renderBody() {
    let orgId = this.props.params.orgId;
    let itemList = this.state.itemList;
    let hasItemList = itemList && itemList.length > 0;

    return (
      <div>
        <div className="pull-right">
          <DropdownReact
            anchorRight
            alwaysRenderMenu
            className="btn btn-primary btn-sm"
            title={t('Add Repository')}
          >
            {this.state.repoConfig.providers.map(provider => {
              return (
                <MenuItem noAnchor={true} key={provider.id}>
                  <AddRepositoryLink
                    provider={provider}
                    orgId={orgId}
                    onSuccess={this.onAddRepo}
                  />
                </MenuItem>
              );
            })}
          </DropdownReact>
        </div>
        <h3 className="m-b-2">{t('Repositories')}</h3>
        {hasItemList && (
          <div className="m-b-2">
            <p>
              {t(
                'Connecting a repository allows Sentry to capture commit data via webhooks. ' +
                  'This enables features like suggested assignees and resolving issues via commit message. ' +
                  "Once you've connected a repository, you can associate commits with releases via the API."
              )}
              &nbsp;
              {tct('See our [link:documentation] for more details.', {
                link: <a href="https://docs.sentry.io/learn/releases/" />,
              })}
            </p>
          </div>
        )}
        {hasItemList ? (
          <div className="panel panel-default">
            <table className="table">
              <tbody>
                {itemList.map(repo => {
                  let repoIsVisible = repo.status === 'visible';
                  return (
                    <tr key={repo.id}>
                      <td>
                        <strong>{repo.name}</strong>
                        {!repoIsVisible && <small> — {this.getStatusLabel(repo)}</small>}
                        {repo.status === 'pending_deletion' && (
                          <small>
                            {' '}
                            (
                            <a onClick={() => this.cancelDelete(repo)}>{t('Cancel')}</a>
                            )
                          </small>
                        )}
                        <br />
                        <small>{repo.provider.name}</small>
                        {repo.url && (
                          <small>
                            {' '}
                            — <a href={repo.url}>{repo.url}</a>
                          </small>
                        )}
                      </td>
                      <td style={{width: 60}}>
                        <Confirm
                          disabled={!repoIsVisible}
                          onConfirm={() => this.deleteRepo(repo)}
                          message={t('Are you sure you want to remove this repository?')}
                        >
                          <Button size="xsmall">
                            <span className="icon icon-trash" />
                          </Button>
                        </Confirm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="well blankslate align-center p-x-2 p-y-1">
            <div className="icon icon-lg icon-git-commit" />
            <h3>{t('Sentry is better with commit data')}</h3>
            <p>
              {t(
                'Adding one or more repositories will enable enhanced releases and the ability to resolve Sentry Issues via git message.'
              )}
            </p>
            <p className="m-b-1">
              <a
                className="btn btn-default"
                href="https://docs.sentry.io/learn/releases/"
              >
                Learn more
              </a>
            </p>
          </div>
        )}
      </div>
    );
  }
}

export default OrganizationRepositories;
