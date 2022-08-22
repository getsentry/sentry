import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {JsonFormObject} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {User} from 'sentry/types';
import AsyncView from 'sentry/views/asyncView';

const userEditForm: JsonFormObject = {
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

type DeleteType = 'disable' | 'delete';

type RemoveModalProps = ModalRenderProps & {
  onRemove: (type: DeleteType) => void;
  user: User;
};

type RemoveModalState = {
  deleteType: DeleteType;
};

class RemoveUserModal extends Component<RemoveModalProps, RemoveModalState> {
  state: RemoveModalState = {
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
      <Fragment>
        <RadioGroup
          value={deleteType}
          label={t('Remove user %s', user.email)}
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
          <Button onClick={this.props.closeModal}>{t('Cancel')}</Button>
        </ModalFooter>
      </Fragment>
    );
  }
}

type Props = AsyncView['props'] & RouteComponentProps<{id: string}, {}>;

type State = AsyncView['state'] & {
  user: User | null;
};

class AdminUserEdit extends AsyncView<Props, State> {
  get userEndpoint() {
    const {params} = this.props;
    return `/users/${params.id}/`;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['user', this.userEndpoint]];
  }

  async deleteUser() {
    await this.api.requestPromise(this.userEndpoint, {
      method: 'DELETE',
      data: {hardDelete: true, organizations: []},
    });

    addSuccessMessage(t("%s's account has been deleted.", this.state.user?.email));
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

  removeUser = (actionTypes: DeleteType) =>
    actionTypes === 'delete' ? this.deleteUser() : this.deactivateUser();

  formModel = new FormModel();

  renderBody() {
    const {user} = this.state;

    if (user === null) {
      return null;
    }

    const openDeleteModal = () =>
      openModal(opts => (
        <RemoveUserModal user={user} onRemove={this.removeUser} {...opts} />
      ));

    return (
      <Fragment>
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
      </Fragment>
    );
  }
}

const ModalFooter = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  justify-content: end;
  padding: 20px 30px;
  margin: 20px -30px -30px;
  border-top: 1px solid ${p => p.theme.border};
`;

export default AdminUserEdit;
