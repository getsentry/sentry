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
  projectID: number;
  organization: Organization;
  transactionName: string;
  children: (props: ChildrenProps) => React.ReactNode;
};

type State = {
  isLoading: boolean;
  keyFetchID: symbol | undefined;
  error: null | string;

  isKeyTransaction: boolean;
};

class KeyTransactionQuery extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    keyFetchID: undefined,
    error: null,

    isKeyTransaction: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugChanged = prevProps.organization.slug !== this.props.organization.slug;
    const projectsChanged = prevProps.projectID !== this.props.projectID;

    if (orgSlugChanged || projectsChanged) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {projectID, organization, transactionName} = this.props;

    const projects = [projectID];

    const url = `/organizations/${organization.slug}/is-key-transactions/`;
    const keyFetchID = Symbol('keyFetchID');

    this.setState({isLoading: true, keyFetchID});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: projects.map(id => String(id)),
          transaction: transactionName,
        },
      })
      .then(([data, _, _jqXHR]) => {
        if (this.state.keyFetchID !== keyFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({
          isLoading: false,
          keyFetchID: undefined,
          error: null,
          isKeyTransaction: !!data?.isKey,
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          keyFetchID: undefined,
          error: err.responseJSON.detail,
          isKeyTransaction: false,
        });
      });
  };

  toggleKeyTransaction = () => {
    const {api, projectID, organization, transactionName} = this.props;
    const projects = [projectID];

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
