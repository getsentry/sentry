import React from 'react';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconStar} from 'app/icons';
import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {toggleKeyTransaction} from 'app/actionCreators/performance';

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

  toggleKeyTransactionHandler = () => {
    const {eventView, api, organization, transactionName} = this.props;
    const {isKeyTransaction} = this.state;
    const projects = eventView.project as number[];

    trackAnalyticsEvent({
      eventName: 'Performance Views: Key Transaction toggle',
      eventKey: 'performance_views.key_transaction.toggle',
      orgId: parseInt(organization.id, 10),
      action: isKeyTransaction ? 'remove' : 'add',
    });

    toggleKeyTransaction(
      api,
      isKeyTransaction,
      organization.slug,
      projects,
      transactionName
    ).then(() => {
      this.setState({isKeyTransaction: !isKeyTransaction});
    });
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
            color={isKeyTransaction ? 'yellow400' : 'gray400'}
            isSolid={!!isKeyTransaction}
          />
        }
        onClick={this.toggleKeyTransactionHandler}
      >
        {t('Key Transaction')}
      </Button>
    );
  }
}

export default withApi(KeyTransactionButton);
