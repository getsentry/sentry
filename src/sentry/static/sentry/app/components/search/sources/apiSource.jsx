import flatten from 'lodash/flatten';
import debounce from 'lodash/debounce';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'app/api';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import {singleLineRenderer as markedSingleLine} from 'app/utils/marked';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import withLatestContext from 'app/utils/withLatestContext';
import {documentIntegrationList} from 'app/views/organizationIntegrations/constants';

// event ids must have string length of 32
const shouldSearchEventIds = query => typeof query === 'string' && query.length === 32;

// STRING-HEXVAL
const shouldSearchShortIds = query => /[\w\d]+-[\w\d]+/.test(query);

// Helper functions to create result objects
async function createOrganizationResults(organizationsPromise) {
  const organizations = (await organizationsPromise) || [];
  return flatten(
    organizations.map(org => [
      {
        title: t('%s Dashboard', org.slug),
        description: t('Organization Dashboard'),
        model: org,
        sourceType: 'organization',
        resultType: 'route',
        to: `/${org.slug}/`,
      },
      {
        title: t('%s Settings', org.slug),
        description: t('Organization Settings'),
        model: org,
        sourceType: 'organization',
        resultType: 'settings',
        to: `/settings/${org.slug}/`,
      },
    ])
  );
}
async function createProjectResults(projectsPromise, orgId) {
  const projects = (await projectsPromise) || [];
  return flatten(
    projects.map(project => [
      {
        title: `${project.slug} Settings`,
        description: 'Project Settings',
        model: project,
        sourceType: 'project',
        resultType: 'settings',
        to: `/settings/${orgId}/projects/${project.slug}/`,
      },
    ])
  );
}
async function createTeamResults(teamsPromise, orgId) {
  const teams = (await teamsPromise) || [];
  return teams.map(team => ({
    title: `#${team.slug}`,
    description: 'Team Settings',
    model: team,
    sourceType: 'team',
    resultType: 'settings',
    to: `/settings/${orgId}/teams/${team.slug}/`,
  }));
}

async function createMemberResults(membersPromise, orgId) {
  const members = (await membersPromise) || [];
  return members.map(member => ({
    title: member.name,
    description: member.email,
    model: member,
    sourceType: 'member',
    resultType: 'settings',
    to: `/settings/${orgId}/members/${member.id}/`,
  }));
}

async function createPluginResults(pluginsPromise, orgId) {
  const plugins = (await pluginsPromise) || [];
  return plugins
    .filter(plugin => {
      //show a plugin if it is not hidden (aka legacy) or if we have projects with it configured
      return !plugin.isHidden || !!plugin.projectList.length;
    })
    .map(plugin => ({
      title: plugin.isHidden ? `${plugin.name} (Legacy)` : plugin.name,
      description: (
        <span
          dangerouslySetInnerHTML={{
            __html: markedSingleLine(plugin.description),
          }}
        />
      ),
      model: plugin,
      sourceType: 'plugin',
      resultType: 'integration',
      to: `/settings/${orgId}/plugins/${plugin.id}/`,
    }));
}

async function createIntegrationResults(integrationsPromise, orgId) {
  const {providers} = (await integrationsPromise) || {};
  return (
    (providers &&
      providers.map(provider => ({
        title: provider.name,
        description: (
          <span
            dangerouslySetInnerHTML={{
              __html: markedSingleLine(provider.metadata.description),
            }}
          />
        ),
        model: provider,
        sourceType: 'integration',
        resultType: 'integration',
        to: `/settings/${orgId}/integrations/`,
      }))) ||
    []
  );
}

async function createSentryAppResults(sentryAppPromise, orgId) {
  const sentryApps = (await sentryAppPromise) || [];
  return sentryApps.map(sentryApp => ({
    title: sentryApp.name,
    description: (
      <span
        dangerouslySetInnerHTML={{
          __html: markedSingleLine(sentryApp.overview || ''),
        }}
      />
    ),
    model: sentryApp,
    sourceType: 'sentryApp',
    resultType: 'integration',
    to: `/settings/${orgId}/sentry-apps/${sentryApp.slug}/`,
  }));
}

//Not really async but we need to return a promise
async function creatDocIntegrationResults(orgId) {
  return documentIntegrationList.map(integration => ({
    title: integration.name,
    description: (
      <span
        dangerouslySetInnerHTML={{
          __html: markedSingleLine(integration.description),
        }}
      />
    ),
    model: integration,
    sourceType: 'docIntegration',
    resultType: 'integration',
    to: `/settings/${orgId}/document-integrations/${integration.slug}/`,
  }));
}

async function createShortIdLookupResult(shortIdLookupPromise) {
  const shortIdLookup = await shortIdLookupPromise;
  if (!shortIdLookup) {
    return null;
  }

  const issue = shortIdLookup && shortIdLookup.group;
  return {
    item: {
      title: `${
        (issue && issue.metadata && issue.metadata.type) || shortIdLookup.shortId
      }`,
      description: `${(issue && issue.metadata && issue.metadata.value) || t('Issue')}`,
      model: shortIdLookup.group,
      sourceType: 'issue',
      resultType: 'issue',
      to: `/${shortIdLookup.organizationSlug}/${shortIdLookup.projectSlug}/issues/${shortIdLookup.groupId}/`,
    },
  };
}

async function createEventIdLookupResult(eventIdLookupPromise) {
  const eventIdLookup = await eventIdLookupPromise;
  if (!eventIdLookup) {
    return null;
  }

  const event = eventIdLookup && eventIdLookup.event;
  return {
    item: {
      title: `${(event && event.metadata && event.metadata.type) || t('Event')}`,
      description: `${event && event.metadata && event.metadata.value}`,
      sourceType: 'event',
      resultType: 'event',
      to: `/${eventIdLookup.organizationSlug}/${eventIdLookup.projectSlug}/issues/${eventIdLookup.groupId}/events/${eventIdLookup.eventId}/`,
    },
  };
}

class ApiSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    // fuse.js options
    searchOptions: PropTypes.object,

    // Organization used for search context
    organization: SentryTypes.Organization,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  static defaultProps = {
    searchOptions: {},
  };

  constructor(props, ...args) {
    super(props, ...args);
    this.state = {
      loading: false,
      allResults: null,
      searchResults: null,
      directResults: null,
      fuzzy: null,
    };

    this.api = new Client();

    if (typeof props.query !== 'undefined') {
      this.doSearch(props.query);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // Limit the number of times we perform API queries by only attempting API queries
    // using first two characters, otherwise perform in-memory search.
    //
    // Otherwise it'd be constant :spinning_loading_wheel:
    if (
      (nextProps.query.length <= 2 &&
        nextProps.query.substr(0, 2) !== this.props.query.substr(0, 2)) ||
      // Also trigger a search if next query value satisfies an eventid/shortid query
      shouldSearchShortIds(nextProps.query) ||
      shouldSearchEventIds(nextProps.query)
    ) {
      this.setState({loading: true});
      this.doSearch(nextProps.query);
    }
  }

  // Debounced method to handle querying all API endpoints (when necessary)
  doSearch = debounce(async query => {
    const {params, organization} = this.props;
    const orgId = (params && params.orgId) || (organization && organization.slug);
    let searchUrls = ['/organizations/'];
    let directUrls = [];

    // Only run these queries when we have an org in context
    if (orgId) {
      searchUrls = [
        ...searchUrls,
        `/organizations/${orgId}/projects/`,
        `/organizations/${orgId}/teams/`,
        `/organizations/${orgId}/members/`,
        `/organizations/${orgId}/plugins/configs/`,
        `/organizations/${orgId}/config/integrations/`,
        '/sentry-apps/?status=published',
      ];

      directUrls = [
        shouldSearchShortIds(query) ? `/organizations/${orgId}/shortids/${query}/` : null,
        shouldSearchEventIds(query) ? `/organizations/${orgId}/eventids/${query}/` : null,
      ];
    }

    const searchRequests = searchUrls.map(url =>
      this.api
        .requestPromise(url, {
          query: {
            query,
          },
        })
        .then(
          resp => resp,
          err => {
            this.handleRequestError(err, {orgId, url});
            return null;
          }
        )
    );

    const directRequests = directUrls.map(url => {
      if (!url) {
        return Promise.resolve(null);
      }

      return this.api.requestPromise(url).then(
        resp => resp,
        err => {
          // No need to log 404 errors
          if (err && err.status === 404) {
            return null;
          }
          this.handleRequestError(err, {orgId, url});
          return null;
        }
      );
    });

    this.handleSearchRequest(searchRequests, directRequests);
  }, 150);

  handleRequestError = (err, {url, orgId}) => {
    Sentry.withScope(scope => {
      scope.setExtra(
        'url',
        url.replace(`/organizations/${orgId}/`, '/organizations/:orgId/')
      );
      Sentry.captureException(
        new Error(
          `API Source Failed: ${err && err.responseJSON && err.responseJSON.detail}`
        )
      );
    });
  };

  // Handles a list of search request promises, and then updates state with response objects
  async handleSearchRequest(searchRequests, directRequests) {
    const {searchOptions} = this.props;

    // Note we don't wait for all requests to resolve here (e.g. `await Promise.all(reqs)`)
    // so that we can start processing before all API requests are resolved
    //
    // This isn't particularly helpful in its current form because we still wait for all requests to finish before
    // updating state, but you could potentially optimize rendering direct results before all requests are finished.
    const [
      organizations,
      projects,
      teams,
      members,
      plugins,
      integrations,
      sentryApps,
    ] = searchRequests;
    const [shortIdLookup, eventIdLookup] = directRequests;

    const [searchResults, directResults] = await Promise.all([
      this.getSearchableResults([
        organizations,
        projects,
        teams,
        members,
        plugins,
        integrations,
        sentryApps,
      ]),
      this.getDirectResults([shortIdLookup, eventIdLookup]),
    ]);

    //TODO(XXX): Might consider adding logic to maintain consistent ordering of results so things don't switch positions
    const fuzzy = createFuzzySearch(searchResults, {
      ...searchOptions,
      keys: ['title', 'description'],
    });

    this.setState({
      loading: false,
      allResults: [...searchResults, ...directResults],
      fuzzy: await fuzzy,
      directResults,
    });
  }

  // Process API requests that create result objects that should be searchable
  async getSearchableResults(requests) {
    const {params, organization} = this.props;
    const orgId = (params && params.orgId) || (organization && organization.slug);
    const [
      organizations,
      projects,
      teams,
      members,
      plugins,
      integrations,
      sentryApps,
    ] = requests;
    const searchResults = flatten(
      await Promise.all([
        createOrganizationResults(organizations),
        createProjectResults(projects, orgId),
        createTeamResults(teams, orgId),
        createMemberResults(members, orgId),
        createIntegrationResults(integrations, orgId),
        createPluginResults(plugins, orgId),
        createSentryAppResults(sentryApps, orgId),
        creatDocIntegrationResults(orgId),
      ])
    );

    return searchResults;
  }

  // Create result objects from API requests that do not require fuzzy search
  // i.e. these responses only return 1 object or they should always be displayed regardless of query input
  async getDirectResults(requests) {
    const [shortIdLookup, eventIdLookup] = requests;

    const directResults = (
      await Promise.all([
        createShortIdLookupResult(shortIdLookup),
        createEventIdLookupResult(eventIdLookup),
      ])
    ).filter(result => !!result);

    if (!directResults.length) {
      return [];
    }

    return directResults;
  }

  render() {
    const {children, query} = this.props;
    const {fuzzy, directResults} = this.state;
    const results = (fuzzy && fuzzy.search(query)) || null;

    return children({
      isLoading: this.state.loading,
      allResults: this.state.allResults,
      results: flatten([results, directResults].filter(arr => !!arr)) || null,
    });
  }
}

export {ApiSource};
export default withLatestContext(withRouter(ApiSource));
