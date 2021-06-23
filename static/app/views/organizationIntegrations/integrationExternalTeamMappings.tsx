import * as React from 'react';

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
  queryResults: Team[];
};

class IntegrationExternalTeamMappings extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      teams: [],
      queryResults: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'teams',
        `/organizations/${organization.slug}/teams/`,
        {query: {query: 'hasExternalTeams:true'}},
      ],
    ];
  }

  handleDelete = async (mapping: ExternalActorMapping) => {
    try {
      const {organization} = this.props;
      const {teams} = this.state;
      const team = teams.find(item => item.id === mapping.teamId);
      if (!team) {
        throw new Error('Cannot find correct team slug.');
      }
      const endpoint = `/teams/${organization.slug}/${team.slug}/external-teams/${mapping.id}/`;

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
          .map(externalTeam => ({...externalTeam, sentryName: team.slug}))
      );
      return acc;
    }, [] as ExternalActorMapping[]);
    return externalTeamMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  sentryNamesMapper(teams: Team[]) {
    return teams.map(({id, slug}) => ({id, name: slug}));
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
      const {queryResults} = this.state;
      const team = queryResults.find(item => item.id === data.teamId);

      if (!team) {
        throw new Error('Cannot find team slug.');
      }

      const baseEndpoint = `/teams/${organization.slug}/${team.slug}/external-teams/`;
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
      // no 4xx errors should happen on delete
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
            sentryNamesMapper={this.sentryNamesMapper}
            type="team"
            url={`/organizations/${organization.slug}/teams/`}
            onCancel={closeModal}
            onSubmit={(...args) => this.handleSubmit(...args, mapping)}
            onResults={results => this.setState({queryResults: results})}
          />
        </Body>
      </React.Fragment>
    ));
  };

  renderBody() {
    const {integration} = this.props;
    return (
      <IntegrationExternalMappings
        integration={integration}
        type="team"
        mappings={this.mappings}
        onCreateOrEdit={this.openModal}
        onDelete={this.handleDelete}
      />
    );
  }
}

export default withOrganization(IntegrationExternalTeamMappings);
