import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import AsyncComponent from 'sentry/components/asyncComponent';
import IntegrationExternalMappingForm from 'sentry/components/integrationExternalMappingForm';
import IntegrationExternalMappings from 'sentry/components/integrationExternalMappings';
import {t} from 'sentry/locale';
import {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalUser,
  Integration,
  Member,
  Organization,
} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = AsyncComponent['props'] &
  WithRouterProps & {
    integration: Integration;
    organization: Organization;
  };

type State = AsyncComponent['state'] & {
  members: (Member & {externalUsers: ExternalUser[]})[];
};

class IntegrationExternalUserMappings extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'members',
        `/organizations/${organization.slug}/members/`,
        {query: {query: 'hasExternalUsers:true', expand: 'externalUsers'}},
      ],
    ];
  }

  handleDelete = async (mapping: ExternalActorMapping) => {
    const {organization} = this.props;
    const endpoint = `/organizations/${organization.slug}/external-users/${mapping.id}/`;
    try {
      await this.api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      // remove config and update state
      addSuccessMessage(t('Deletion successful'));
      this.fetchData();
    } catch {
      // no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  handleSubmitSuccess = () => {
    // Don't bother updating state. The info is in array of objects for each object in another array of objects.
    // Easier and less error-prone to re-fetch the data and re-calculate state.
    this.fetchData();
  };

  get mappings() {
    const {integration} = this.props;
    const {members} = this.state;
    const externalUserMappings = members.reduce((acc, member) => {
      const {externalUsers, user} = member;

      acc.push(
        ...externalUsers
          .filter(externalUser => externalUser.provider === integration.provider.key)
          .map(externalUser => ({...externalUser, sentryName: user.name}))
      );
      return acc;
    }, [] as ExternalActorMapping[]);
    return externalUserMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  sentryNamesMapper(members: Member[]) {
    return members
      .filter(member => member.user)
      .map(({user: {id}, email, name}) => {
        const label = email !== name ? `${name} - ${email}` : `${email}`;
        return {id, name: label};
      });
  }

  openModal = (mapping?: ExternalActorMappingOrSuggestion) => {
    const {organization, integration} = this.props;
    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>{t('Configure External User Mapping')}</Header>
        <Body>
          <IntegrationExternalMappingForm
            organization={organization}
            integration={integration}
            onSubmitSuccess={() => {
              this.handleSubmitSuccess();
              closeModal();
            }}
            mapping={mapping}
            sentryNamesMapper={this.sentryNamesMapper}
            type="user"
            url={`/organizations/${organization.slug}/members/`}
            onCancel={closeModal}
            baseEndpoint={`/organizations/${organization.slug}/external-users/`}
          />
        </Body>
      </Fragment>
    ));
  };

  renderBody() {
    const {integration, organization} = this.props;
    const {membersPageLinks} = this.state;
    return (
      <Fragment>
        <IntegrationExternalMappings
          integration={integration}
          organization={organization}
          type="user"
          mappings={this.mappings}
          sentryNamesMapper={this.sentryNamesMapper}
          onCreateOrEdit={this.openModal}
          onDelete={this.handleDelete}
          pageLinks={membersPageLinks}
        />
      </Fragment>
    );
  }
}

export default withRouter(withOrganization(IntegrationExternalUserMappings));
