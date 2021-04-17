import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import AsyncComponent from 'app/components/asyncComponent';
import IntegrationExternalMappingForm from 'app/components/integrationExternalMappingForm';
import IntegrationExternalMappings from 'app/components/integrationExternalMappings';
import {t} from 'app/locale';
import {ExternalActorMapping, Integration, Organization, Team} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import FormModel from 'app/views/settings/components/forms/model';

type Props = AsyncComponent['props'] & {
  integration: Integration;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
  teams: Team[];
};

class IntegrationExternalTeamMappings extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['teams', `/organizations/${organization.slug}/teams/`]];
  }

  handleDelete = async (mapping: ExternalActorMapping) => {
    try {
      const {organization} = this.props;
      const {teams} = this.state;
      const team = teams.find(t => t.id === mapping.teamId);
      if (!team) {
        throw new Error('Cannot find correct team slug.');
      }
      const endpoint = `/teams/${organization.slug}/${team.slug}/externalteam/${mapping.id}/`;

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
    this.fetchData();
  };

  get mappings() {
    const {integration} = this.props;
    const {teams} = this.state;
    const externalTeamMappings = teams.reduce((acc, team) => {
      const {externalTeams} = team;
      acc.push(
        ...externalTeams
          .filter(externalTeam => externalTeam.provider === integration.provider.key)
          .map(externalTeam => ({...externalTeam, sentryName: team.name}))
      );
      return acc;
    }, [] as ExternalActorMapping[]);
    return externalTeamMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  get sentryNames() {
    const {teams} = this.state;
    return teams;
  }

  handleSubmit = (
    data: Record<string, any>,
    onSubmitSuccess: (data: Record<string, any>) => void,
    onSubmitError: (error: any) => void,
    _: React.FormEvent<Element>,
    model: FormModel,
    mapping?: ExternalActorMapping
  ) => {
    // We need to dynamically set the endpoint bc it requires the slug of the selected team in the form.
    try {
      const {organization} = this.props;
      const {teams} = this.state;
      const team = teams.find(t => t.id === data.teamId);

      if (!team) {
        throw new Error('Cannot find team slug.');
      }

      const baseEndpoint = `/teams/${organization.slug}/${team.slug}/externalteam/`;
      const apiEndpoint = mapping ? `${baseEndpoint}${mapping.id}/` : baseEndpoint;
      const apiMethod = mapping ? 'PUT' : 'POST';

      model.setFormOptions({
        onSubmitSuccess,
        onSubmitError,
        apiEndpoint,
        apiMethod,
      });

      model.saveForm();
    } catch {
      //no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  openModal = (mapping?: ExternalActorMapping) => {
    const {organization, integration} = this.props;
    openModal(({Body, Header, closeModal}) => (
      <React.Fragment>
        <Header closeButton>{t('Configure External Team Mapping')}</Header>
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
            type="team"
            onCancel={closeModal}
            onSubmit={(...args) => this.handleSubmit(...args, mapping)}
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
          type="team"
          mappings={this.mappings}
          onCreateOrEdit={this.openModal}
          onDelete={this.handleDelete}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(IntegrationExternalTeamMappings);
