import React from 'react';
import {Modal} from 'react-bootstrap';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {createSavedSearch} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import {TextField} from 'app/components/forms';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {LightWeightOrganization} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  query: string;
  organization: LightWeightOrganization;
  buttonClassName?: string;
  iconOnly?: boolean;
  withTooltip?: boolean;
};

type State = {
  isModalOpen: boolean;
  isSaving: boolean;
  name: string;
  error: string | null;
  query: string | null;
};

type FieldOnChangeParameters = Parameters<NonNullable<TextField['props']['onChange']>>[0];

class CreateSavedSearchButton extends React.Component<Props, State> {
  state: State = {
    isModalOpen: false,
    isSaving: false,
    name: '',
    error: null,
    query: null,
  };

  onSubmit = (e: React.FormEvent) => {
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

  onToggle = (event?: React.MouseEvent) => {
    const newState: State = {
      ...this.state,
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

  handleChangeName = (val: FieldOnChangeParameters) => {
    this.setState({name: String(val)});
  };

  handleChangeQuery = (val: FieldOnChangeParameters) => {
    this.setState({query: String(val)});
  };

  render() {
    const {isSaving, isModalOpen, error} = this.state;
    const {organization, query, buttonClassName, iconOnly, withTooltip} = this.props;

    return (
      <Access organization={organization} access={['org:write']}>
        <Button
          title={withTooltip ? t('Add to organization saved searches') : undefined}
          onClick={this.onToggle}
          data-test-id="save-current-search"
          size="zero"
          borderless
          type="button"
          aria-label={t('Add to organization saved searches')}
          icon={<IconAdd size="xs" />}
          className={buttonClassName}
        >
          {!iconOnly && t('Create Saved Search')}
        </Button>
        <Modal show={isModalOpen} animation={false} onHide={this.onToggle}>
          <form onSubmit={this.onSubmit}>
            <Modal.Header>
              <h4>{t('Save Current Search')}</h4>
            </Modal.Header>

            <Modal.Body>
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
            </Modal.Body>
            <Modal.Footer>
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
            </Modal.Footer>
          </form>
        </Modal>
      </Access>
    );
  }
}

export default withApi(CreateSavedSearchButton);
