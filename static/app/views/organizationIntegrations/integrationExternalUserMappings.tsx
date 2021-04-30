import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import AsyncComponent from 'app/components/asyncComponent';
import IntegrationExternalMappingForm from 'app/components/integrationExternalMappingForm';
import IntegrationExternalMappings from 'app/components/integrationExternalMappings';
import {t} from 'app/locale';
import {
  ExternalActorMapping,
  ExternalUser,
  Integration,
  Member,
  Organization,
} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = AsyncComponent['props'] & {
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
        {query: {expand: 'externalUsers'}},
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
      //no 4xx errors should happen on delete
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

  get sentryNames() {
    const {members} = this.state;
    return members.map(({id, email, name, ...rest}) => {
      const label = email !== name ? `${name} - ${email}` : `${email}`;
      return {...rest, id, name: label, email};
    });
  }

  openModal = (mapping?: ExternalActorMapping) => {
    const {organization, integration} = this.props;
    openModal(({Body, Header, closeModal}) => (
      <React.Fragment>
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
            sentryNames={this.sentryNames}
            type="user"
            onCancel={closeModal}
            baseEndpoint={`/organizations/${organization.slug}/external-users/`}
          />
        </Body>
      </React.Fragment>
    ));
  };

  renderBody() {
    const {integration} = this.props;
    return (
      <React.Fragment>
        <IntegrationExternalMappings
          integration={integration}
          type="user"
          mappings={this.mappings}
          onCreateOrEdit={this.openModal}
          onDelete={this.handleDelete}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(IntegrationExternalUserMappings);
