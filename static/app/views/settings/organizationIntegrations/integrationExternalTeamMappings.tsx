import {Fragment} from 'react';
import uniqBy from 'lodash/uniqBy';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types/integrations';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization, Team} from 'sentry/types/organization';
import {sentryNameToOption} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import IntegrationExternalMappingForm from './integrationExternalMappingForm';
import IntegrationExternalMappings from './integrationExternalMappings';

type Props = DeprecatedAsyncComponent['props'] &
  WithRouterProps & {
    integration: Integration;
    organization: Organization;
  };

type State = DeprecatedAsyncComponent['state'] & {
  initialResults: Team[];
  queryResults: {
    // For inline forms, the mappingKey will be the external name (since multiple will be rendered at one time)
    // For the modal form, the mappingKey will be this.modalMappingKey (since only one modal form is rendered at any time)
    [mappingKey: string]: Team[];
  };
  teams: Team[];
};

class IntegrationExternalTeamMappings extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      teams: [],
      initialResults: [],
      queryResults: {},
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    return [
      // We paginate on this query, since we're filtering by hasExternalTeams:true
      [
        'teams',
        `/organizations/${organization.slug}/teams/`,
        {query: {...location?.query, query: 'hasExternalTeams:true'}},
      ],
      // We use this query as defaultOptions to reduce identical API calls
      ['initialResults', `/organizations/${organization.slug}/teams/`],
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
    const externalTeamMappings = teams.reduce<ExternalActorMapping[]>((acc, team) => {
      const {externalTeams} = team;
      acc.push(
        ...externalTeams
          .filter(externalTeam => externalTeam.provider === integration.provider.key)
          .map(externalTeam => ({...externalTeam, sentryName: team.slug}))
      );
      return acc;
    }, []);
    return externalTeamMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  }

  modalMappingKey = '__MODAL_RESULTS__';

  get dataEndpoint() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/teams/`;
  }

  get defaultTeamOptions() {
    const {initialResults} = this.state;
    return this.sentryNamesMapper(initialResults).map(sentryNameToOption);
  }

  getBaseFormEndpoint(mapping?: ExternalActorMappingOrSuggestion) {
    if (!mapping) {
      return '';
    }
    const {organization} = this.props;
    const {queryResults, initialResults} = this.state;
    const fieldResults =
      queryResults[mapping.externalName] ?? queryResults[this.modalMappingKey];
    const team =
      // First, search for the team in the query results...
      fieldResults?.find(item => item.id === mapping.teamId) ??
      // Then in the initial results, if nothing was found.
      initialResults?.find(item => item.id === mapping.teamId);
    return `/teams/${organization.slug}/${team?.slug ?? ''}/external-teams/`;
  }

  sentryNamesMapper(teams: Team[]) {
    return teams.map(({id, slug}) => ({id, name: slug}));
  }

  /**
   * This method combines the results from searches made on a form dropping repeated entries
   * that have identical 'id's. This is because we need the result of the search query when
   * the user submits to get the team slug, but it won't always be the last query they've made.
   *
   * If they search (but not select) after making a selection, and we didn't keep a running collection of results,
   * we wouldn't have the team to generate the endpoint from.
   */
  combineResultsById = (resultList1: any, resultList2: any) => {
    return uniqBy([...resultList1, ...resultList2], 'id');
  };

  handleResults = (results: any, mappingKey?: string) => {
    if (mappingKey) {
      const {queryResults} = this.state;
      this.setState({
        queryResults: {
          ...queryResults,
          // Ensure we always have a team to pull the slug from
          [mappingKey]: this.combineResultsById(results, queryResults[mappingKey] ?? []),
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
            defaultOptions={this.defaultTeamOptions}
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
        defaultOptions={this.defaultTeamOptions}
        sentryNamesMapper={this.sentryNamesMapper}
        onCreate={this.openModal}
        onDelete={this.handleDelete}
        pageLinks={teamsPageLinks}
        onResults={this.handleResults}
      />
    );
  }
}

export default withSentryRouter(withOrganization(IntegrationExternalTeamMappings));
