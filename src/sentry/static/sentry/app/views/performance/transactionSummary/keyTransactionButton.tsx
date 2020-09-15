import React from 'react';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconStar} from 'app/icons';
import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
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

    trackAnalyticsEvent({
      eventName: 'Performance Views: Key Transaction toggle',
      eventKey: 'performance_views.key_transaction.toggle',
      orgId: parseInt(organization.id, 10),
      action: this.state.isKeyTransaction ? 'remove' : 'add',
    });

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
    const {isKeyTransaction, isLoading} = this.state;

    if (this.props.eventView.project.length !== 1 || isLoading) {
      return null;
    }

    return (
      <Button
        icon={
          <IconStar
            size="xs"
            color={isKeyTransaction ? 'yellow500' : 'gray500'}
            isSolid={!!isKeyTransaction}
          />
        }
        onClick={this.toggleKeyTransaction}
      >
        {t('Key Transaction')}
      </Button>
    );
  }
}

export default withApi(KeyTransactionButton);
