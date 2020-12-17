import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import {updateOrganization} from 'app/actionCreators/organizations';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import {IconAdd} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization, Relay, RelayActivity} from 'app/types';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

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
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!isEqual(prevState.relays, this.state.relays)) {
      // Fetch fresh activities
      this.fetchData();
      updateOrganization({...prevProps.organization, trustedRelays: this.state.relays});
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

  renderContent(disabled: boolean) {
    const {relays, relayActivities, loading} = this.state;

    if (loading) {
      return this.renderLoading();
    }

    if (!relays.length) {
      return <EmptyState />;
    }

    return (
      <List
        relays={relays}
        relayActivities={relayActivities}
        onEdit={this.handleOpenEditDialog}
        onRefresh={this.handleRefresh}
        onDelete={this.handleDelete}
        disabled={disabled}
      />
    );
  }

  renderBody() {
    const {organization} = this.props;
    const disabled = !organization.access.includes('org:write');
    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Relay')}
          action={
            <Button
              title={
                disabled ? t('You do not have permission to register keys') : undefined
              }
              priority="primary"
              size="small"
              icon={<IconAdd size="xs" isCircled />}
              onClick={this.handleOpenAddDialog}
              disabled={disabled}
            >
              {t('Register Key')}
            </Button>
          }
        />
        <PermissionAlert />
        <StyledTextBlock>
          {t(
            'Sentry Relay offers enterprise-grade data security by providing a standalone service that acts as a middle layer between your application and sentry.io.'
          )}
        </StyledTextBlock>
        <TextBlock>
          {tct(`Go to [link:Relay Documentation] for setup and details.`, {
            link: <ExternalLink href={RELAY_DOCS_LINK} />,
          })}
        </TextBlock>
        {this.renderContent(disabled)}
      </React.Fragment>
    );
  }
}
export default RelayWrapper;

const StyledTextBlock = styled(TextBlock)`
  max-width: 600px;
`;
