import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

const userEditForm = {
  title: 'User details',
  fields: [
    {
      name: 'name',
      type: 'string',
      required: true,
      label: t('Name'),
    },
    {
      name: 'username',
      type: 'string',
      required: true,
      label: t('Username'),
      help: t('The username is the unique id of the user in the system'),
    },
    {
      name: 'email',
      type: 'string',
      required: true,
      label: t('Email'),
      help: t('The users primary email address'),
    },
    {
      name: 'isActive',
      type: 'boolean',
      required: true,
      label: t('Active'),
      help: t(
        'Designates whether this user should be treated as active. Unselect this instead of deleting accounts.'
      ),
    },
    {
      name: 'isStaff',
      type: 'boolean',
      required: true,
      label: t('Admin'),
      help: t('Designates whether this user can perform administrative functions.'),
    },
    {
      name: 'isSuperuser',
      type: 'boolean',
      required: true,
      label: t('Superuser'),
      help: t(
        'Designates whether this user has all permissions without explicitly assigning them.'
      ),
    },
  ],
};

const REMOVE_BUTTON_LABEL = {
  disable: t('Disable User'),
  delete: t('Permanently Delete User'),
};

class RemoveUserModal extends React.Component {
  static propTypes = {
    user: SentryTypes.User,
    onRemove: PropTypes.func,
    closeModal: PropTypes.func,
  };

  state = {
    deleteType: 'disable',
  };

  onRemove = () => {
    this.props.onRemove(this.state.deleteType);
    this.props.closeModal();
  };

  render() {
    const {user} = this.props;
    const {deleteType} = this.state;

    return (
      <React.Fragment>
        <p>{tct('Removing user [user]', {user: <strong>{user.email}</strong>})}</p>
        <RadioGroup
          value={deleteType}
          onChange={type => this.setState({deleteType: type})}
          choices={[
            ['disable', t('Disable the account.')],
            ['delete', t('Permanently remove the user and their data.')],
          ]}
        />
        <ModalFooter>
          <Button priority="danger" onClick={this.onRemove}>
            {REMOVE_BUTTON_LABEL[deleteType]}
          </Button>
          <Button onClick={this.props.closeModal}>{t('Nevermind')}</Button>
        </ModalFooter>
      </React.Fragment>
    );
  }
}

class AdminUserEdit extends AsyncView {
  get userEndpoint() {
    const {params} = this.props;
    return `/users/${params.id}/`;
  }

  getEndpoints() {
    return [['user', this.userEndpoint]];
  }

  async deleteUser() {
    await this.api.requestPromise(this.userEndpoint, {
      method: 'DELETE',
      data: {hardDelete: true, organizations: []},
    });

    addSuccessMessage(t("%s's account has been deleted.", this.state.user.email));
    browserHistory.replace('/manage/users/');
  }

  async deactivateUser() {
    const response = await this.api.requestPromise(this.userEndpoint, {
      method: 'PUT',
      data: {isActive: false},
    });

    this.setState({user: response});
    this.formModel.setInitialData(response);
    addSuccessMessage(t("%s's account has been deactivated.", response.email));
  }

  removeUser = actionTypes =>
    actionTypes === 'delete' ? this.deleteUser() : this.deactivateUser();

  formModel = new FormModel();

  renderBody() {
    const {user} = this.state;
    const openDeleteModal = () =>
      openModal(opts => (
        <RemoveUserModal user={user} onRemove={this.removeUser} {...opts} />
      ));

    return (
      <React.Fragment>
        <h3>{t('Users')}</h3>
        <p>{t('Editing user: %s', user.email)}</p>
        <Form
          model={this.formModel}
          initialData={user}
          apiMethod="PUT"
          apiEndpoint={this.userEndpoint}
          requireChanges
          onSubmitError={addErrorMessage}
          onSubmitSuccess={data => {
            this.setState({user: data});
            addSuccessMessage('User account updated.');
          }}
          extraButton={
            <Button
              type="button"
              onClick={openDeleteModal}
              style={{marginLeft: space(1)}}
              priority="danger"
            >
              {t('Remove User')}
            </Button>
          }
        >
          <JsonForm forms={[userEditForm]} />
        </Form>
      </React.Fragment>
    );
  }
}

const ModalFooter = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  justify-content: end;
  padding: 20px 30px;
  margin: 20px -30px -30px;
  border-top: 1px solid ${p => p.theme.border};
`;

export default AdminUserEdit;
