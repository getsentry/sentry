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
  Integration,
  Organization,
  Team,
} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = AsyncComponent['props'] &
  WithRouterProps & {
    integration: Integration;
    organization: Organization;
  };

type State = AsyncComponent['state'] & {
  teams: Team[];
  queryResults: {
    // For inline forms, the mappingKey will be the external name (since multiple will be rendered at one time)
    // For the modal form, the mappingKey will be this.modalMappingKey (since only one modal form is rendered at any time)
    [mappingKey: string]: Team[];
  };
};

class IntegrationExternalTeamMappings extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      teams: [],
      queryResults: {},
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    return [
      [
        'teams',
        `/organizations/${organization.slug}/teams/`,
        {query: {...location?.query, query: 'hasExternalTeams:true'}},
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

  modalMappingKey = 'MODAL_RESULTS';

  get dataEndpoint() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/teams/`;
  }

  getBaseFormEndpoint(mapping?: ExternalActorMappingOrSuggestion) {
    if (!mapping) {
      return '';
    }
    const {organization} = this.props;
    const {queryResults} = this.state;
    const mappingResults =
      queryResults[mapping.externalName] ?? queryResults[this.modalMappingKey];
    const team = mappingResults?.find(item => item.id === mapping.teamId);
    return `/teams/${organization.slug}/${team?.slug ?? ''}/external-teams/`;
  }

  sentryNamesMapper(teams: Team[]) {
    return teams.map(({id, slug}) => ({id, name: slug}));
  }

  handleResults = (results, mappingKey?: string) => {
    if (mappingKey) {
      this.setState({
        queryResults: {
          ...this.state.queryResults,
          [mappingKey]: results,
        },
      });
    }
  };

  openModal = (mapping?: ExternalActorMappingOrSuggestion) => {
    const {integration} = this.props;
    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>{t('Configure External Team Mapping')}</Header>
        <Body>
          <IntegrationExternalMappingForm
            type="team"
            integration={integration}
            dataEndpoint={this.dataEndpoint}
            getBaseFormEndpoint={map => this.getBaseFormEndpoint(map)}
            mapping={mapping}
            mappingKey={this.modalMappingKey}
            sentryNamesMapper={this.sentryNamesMapper}
            onCancel={closeModal}
            onResults={this.handleResults}
            onSubmitSuccess={() => {
              this.handleSubmitSuccess();
              closeModal();
            }}
          />
        </Body>
      </Fragment>
    ));
  };

  renderBody() {
    const {integration, organization} = this.props;
    const {teamsPageLinks} = this.state;
    return (
      <IntegrationExternalMappings
        type="team"
        integration={integration}
        organization={organization}
        mappings={this.mappings}
        dataEndpoint={this.dataEndpoint}
        getBaseFormEndpoint={mapping => this.getBaseFormEndpoint(mapping)}
        sentryNamesMapper={this.sentryNamesMapper}
        onCreate={this.openModal}
        onDelete={this.handleDelete}
        pageLinks={teamsPageLinks}
        onResults={this.handleResults}
      />
    );
  }
}

export default withRouter(withOrganization(IntegrationExternalTeamMappings));
