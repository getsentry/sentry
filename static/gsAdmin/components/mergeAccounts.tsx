import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import IndicatorStore from 'sentry/stores/indicatorStore';
import type {User} from 'sentry/types/user';

type Props = ModalRenderProps &
  DeprecatedAsyncComponent['props'] & {
    onAction: (data: any) => void;
    userId: string;
  };

type State = DeprecatedAsyncComponent['state'] & {
  mergeAccounts: {users: User[]};
  selectedUserIds: string[];
};

class MergeAccountsModal extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      mergeAccounts: {users: []},
      selectedUserIds: [],
    };
  }

  componentDidMount() {
    super.componentDidMount();
    this.fetchData();
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['mergeAccounts', `/users/${this.props.userId}/merge-accounts/`]];
  }

  async fetchUserByUsername(username: string) {
    try {
      const encodedUsername = encodeURIComponent(username);
      const data = await this.api.requestPromise(
        `/users/${this.props.userId}/merge-accounts/?username=${encodedUsername}`
      );
      this.setState(state => ({
        mergeAccounts: {users: [...state.mergeAccounts.users, data.user]},
      }));
    } catch {
      this.setState({error: true});
    }
  }

  addUsername: FormProps['onSubmit'] = data => {
    this.fetchUserByUsername(data.username);
  };

  selectUser = (userId: string) =>
    this.setState(({selectedUserIds}) => ({
      selectedUserIds: selectedUserIds.includes(userId)
        ? selectedUserIds.filter(i => i !== userId)
        : [...selectedUserIds, userId],
    }));

  doMerge = async () => {
    const userIds = this.state.selectedUserIds;
    const loadingIndicator = IndicatorStore.add('Saving changes..');

    try {
      await this.api.requestPromise(`/users/${this.props.userId}/merge-accounts/`, {
        method: 'POST',
        data: {users: userIds},
      });
      this.props.onAction({});
    } catch (error) {
      this.props.onAction({error});
    }

    IndicatorStore.remove(loadingIndicator);
    this.props.closeModal();
  };

  renderUsernames() {
    return this.state.mergeAccounts.users.map((user, key) => (
      <label key={key} style={{display: 'block', width: 200, marginBottom: 10}}>
        <input
          type="checkbox"
          name="user"
          value={user.id}
          onChange={() => this.selectUser(user.id)}
          style={{margin: 5}}
        />
        {user.username}
      </label>
    ));
  }

  renderBody() {
    const {Header, Body, Footer} = this.props;

    return (
      <Fragment>
        <Header> Merge Accounts </Header>
        <Body>
          <h5>Listed accounts will be merged into this user.</h5>
          <div>{this.renderUsernames()}</div>
          <Form onSubmit={this.addUsername} hideFooter>
            {this.state.error && (
              <Alert.Container>
                <Alert type="error">Could not find user(s)</Alert>
              </Alert.Container>
            )}
            <TextField
              label="Add another username:"
              name="username"
              placeholder="username"
            />
          </Form>
        </Body>
        <Footer>
          <Button onClick={this.doMerge} priority="primary">
            Merge Account(s)
          </Button>
        </Footer>
      </Fragment>
    );
  }
}

export default MergeAccountsModal;
