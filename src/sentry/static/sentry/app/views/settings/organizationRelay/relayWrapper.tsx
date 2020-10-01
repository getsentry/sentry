import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';

import {openModal} from 'app/actionCreators/modal';
import {t, tct} from 'app/locale';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization, Relay, RelayActivity} from 'app/types';
import ExternalLink from 'app/components/links/externalLink';
import Button from 'app/components/button';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {IconAdd} from 'app/icons';
import AsyncView from 'app/views/asyncView';

import Add from './modals/add';
import Edit from './modals/edit';
import EmptyState from './emptyState';
import List from './list';

const RELAY_DOCS_LINK = 'https://getsentry.github.io/relay/';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = {
  relays: Array<Relay>;
  relayActivities: Array<RelayActivity>;
} & AsyncView['state'];

class RelayWrapper extends AsyncView<Props, State> {
  shouldReload = true;

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!isEqual(prevState.relays, this.state.relays)) {
      // Fetch fresh activities
      this.fetchData();
    }

    super.componentDidUpdate(prevProps, prevState);
  }
  getTitle() {
    return t('Relay');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      relays: this.props.organization.trustedRelays,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [['relayActivities', `/organizations/${organization.slug}/relay_usage/`]];
  }

  setRelays(trustedRelays: Array<Relay>) {
    this.setState({relays: trustedRelays});
  }

  handleDelete = (publicKey: Relay['publicKey']) => async () => {
    const {relays} = this.state;

    const trustedRelays = relays
      .filter(relay => relay.publicKey !== publicKey)
      .map(relay => omit(relay, ['created', 'lastModified']));

    try {
      const response = await this.api.requestPromise(
        `/organizations/${this.props.organization.slug}/`,
        {
          method: 'PUT',
          data: {trustedRelays},
        }
      );
      addSuccessMessage(t('Successfully deleted Relay public key'));
      this.setRelays(response.trustedRelays);
    } catch {
      addErrorMessage(t('An unknown error occurred while deleting Relay public key'));
    }
  };

  successfullySaved(response: Organization, successMessage: string) {
    addSuccessMessage(successMessage);
    this.setRelays(response.trustedRelays);
  }

  handleOpenEditDialog = (publicKey: Relay['publicKey']) => () => {
    const editRelay = this.state.relays.find(relay => relay.publicKey === publicKey);

    if (!editRelay) {
      return;
    }

    openModal(modalProps => (
      <Edit
        {...modalProps}
        savedRelays={this.state.relays}
        api={this.api}
        orgSlug={this.props.organization.slug}
        relay={editRelay}
        onSubmitSuccess={response => {
          this.successfullySaved(response, t('Successfully updated Relay public key'));
        }}
      />
    ));
  };

  handleOpenAddDialog = () => {
    openModal(modalProps => (
      <Add
        {...modalProps}
        savedRelays={this.state.relays}
        api={this.api}
        orgSlug={this.props.organization.slug}
        onSubmitSuccess={response => {
          this.successfullySaved(response, t('Successfully added Relay public key'));
        }}
      />
    ));
  };

  handleRefresh = () => {
    // Fetch fresh activities
    this.fetchData();
  };

  renderBody() {
    const {relays, relayActivities, loading} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Relay')}
          action={
            <Button
              priority="primary"
              size="small"
              icon={<IconAdd size="xs" isCircled />}
              onClick={this.handleOpenAddDialog}
            >
              {t('Register Key')}
            </Button>
          }
        />
        <TextBlock>
          {tct(`Go to [link:Relay Documentation] for setup and details.`, {
            link: <ExternalLink href={RELAY_DOCS_LINK} />,
          })}
        </TextBlock>
        {!relays.length ? (
          <EmptyState
            docsUrl={RELAY_DOCS_LINK}
            onOpenAddDialog={this.handleOpenAddDialog}
          />
        ) : (
          <List
            isLoading={loading}
            relays={relays}
            relayActivities={relayActivities}
            onEdit={this.handleOpenEditDialog}
            onRefresh={this.handleRefresh}
            onDelete={this.handleDelete}
          />
        )}
      </React.Fragment>
    );
  }
}
export default RelayWrapper;
