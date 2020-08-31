import React from 'react';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import {saveKeyTransaction, deleteKeyTransaction} from 'app/actionCreators/performance';

type ChildrenProps = {
  isLoading: boolean;
  error: string | null;
  isKeyTransaction: boolean;
  toggleKeyTransaction: () => void;
};

type Props = {
  api: Client;
  projectId: number;
  organization: Organization;
  transactionName: string;
  children: (props: ChildrenProps) => React.ReactNode;
};

type State = {
  isLoading: boolean;
  keyFetchId: symbol | null;
  error: string | null;

  isKeyTransaction: boolean;
};

class KeyTransactionQuery extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    keyFetchId: null,
    error: null,

    isKeyTransaction: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugChanged = prevProps.organization.slug !== this.props.organization.slug;
    const projectsChanged = prevProps.projectId !== this.props.projectId;

    if (orgSlugChanged || projectsChanged) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {projectId, organization, transactionName} = this.props;

    const projects = [String(projectId)];

    const url = `/organizations/${organization.slug}/is-key-transactions/`;
    const keyFetchId = Symbol('keyFetchId');

    this.setState({isLoading: true, keyFetchId});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: projects,
          transaction: transactionName,
        },
      })
      .then(([data, _, _jqXHR]) => {
        if (this.state.keyFetchId !== keyFetchId) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({
          isLoading: false,
          keyFetchId: null,
          error: null,
          isKeyTransaction: !!data?.isKey,
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          keyFetchId: null,
          error: err.responseJSON.detail,
          isKeyTransaction: false,
        });
      });
  };

  toggleKeyTransaction = () => {
    const {api, projectId, organization, transactionName} = this.props;
    const projects = [projectId];

    if (!this.state.isKeyTransaction) {
      this.setState({
        isKeyTransaction: true,
      });

      saveKeyTransaction(api, organization.slug, projects, transactionName).catch(() => {
        this.setState({
          isKeyTransaction: false,
        });
      });
    } else {
      this.setState({
        isKeyTransaction: false,
      });

      deleteKeyTransaction(api, organization.slug, projects, transactionName).catch(
        () => {
          this.setState({
            isKeyTransaction: true,
          });
        }
      );
    }
  };

  render() {
    const {children} = this.props;
    const {isLoading, error, isKeyTransaction} = this.state;

    return children({
      isLoading,
      error,
      isKeyTransaction,
      toggleKeyTransaction: this.toggleKeyTransaction,
    });
  }
}

export default withApi(KeyTransactionQuery);
