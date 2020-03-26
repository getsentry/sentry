import React from 'react';
import styled from '@emotion/styled';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconStar} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import EventView from 'app/utils/discover/eventView';
import {Organization} from 'app/types';
import {saveKeyTransaction, deleteKeyTransaction} from 'app/actionCreators/performance';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  transactionName: string;
};

type State = {
  isLoading: boolean;
  keyFetchID: symbol | undefined;
  error: null | string;

  isKeyTransaction: boolean;
};

class KeyTransactionButton extends React.Component<Props, State> {
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
    const projectsChanged =
      prevProps.eventView.project.length === 1 &&
      this.props.eventView.project.length === 1 &&
      prevProps.eventView.project[0] !== this.props.eventView.project[0];

    if (orgSlugChanged || projectsChanged) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {organization, eventView, transactionName} = this.props;

    const projects = eventView.project as number[];

    if (projects.length !== 1) {
      return;
    }

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
    const {eventView, api, organization, transactionName} = this.props;
    const projects = eventView.project as number[];

    if (!this.state.isKeyTransaction) {
      saveKeyTransaction(api, organization.slug, projects, transactionName)
        .then(() => {
          this.setState({
            isKeyTransaction: true,
          });
        })
        .catch(() => {
          this.setState({
            isKeyTransaction: false,
          });
        });
    } else {
      deleteKeyTransaction(api, organization.slug, projects, transactionName)
        .then(() => {
          this.setState({
            isKeyTransaction: false,
          });
        })
        .catch(() => {
          this.setState({
            isKeyTransaction: true,
          });
        });
    }
  };

  render() {
    const {isKeyTransaction, isLoading} = this.state;

    if (this.props.eventView.project.length !== 1 || isLoading) {
      return null;
    }

    return (
      <Button onClick={this.toggleKeyTransaction}>
        <StyledIconStar
          size="xs"
          color={isKeyTransaction ? theme.yellow : undefined}
          solid={!!isKeyTransaction}
        />
        {t('Key Transaction')}
      </Button>
    );
  }
}

export default withApi(KeyTransactionButton);

const StyledIconStar = styled(IconStar)`
  margin-right: ${space(1)};
`;
