import {Component} from 'react';
import type {WithRouterProps} from 'react-router';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import type {ResponseMeta} from 'sentry/api';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {
  DocIntegration,
  EventIdResponse,
  IntegrationProvider,
  Member,
  Organization,
  PluginWithProjectList,
  Project,
  SentryApp,
  ShortIdResponse,
  Team,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {singleLineRenderer as markedSingleLine} from 'sentry/utils/marked';
import withLatestContext from 'sentry/utils/withLatestContext';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import type {ChildProps, Result, ResultItem} from './types';
import {strGetFn} from './utils';

// event ids must have string length of 32
const shouldSearchEventIds = (query?: string) =>
  typeof query === 'string' && query.length === 32;

// STRING-HEXVAL
const shouldSearchShortIds = (query: string) => /[\w\d]+-[\w\d]+/.test(query);

// Helper functions to create result objects
async function createOrganizationResults(
  organizationsPromise: Promise<Organization[]>
): Promise<ResultItem[]> {
  const organizations = (await organizationsPromise) || [];
  return organizations.flatMap(org => [
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
  ]);
}
async function createProjectResults(
  projectsPromise: Promise<Project[]>,
  orgId?: string
): Promise<ResultItem[]> {
  const projects = (await projectsPromise) || [];
  return projects.flatMap(project => {
    const projectResults: ResultItem[] = [
      {
        title: t('%s Settings', project.slug),
        description: t('Project Settings'),
        model: project,
        sourceType: 'project',
        resultType: 'settings',
        to: `/settings/${orgId}/projects/${project.slug}/`,
      },
      {
        title: t('%s Alerts', project.slug),
        description: t('List of project alert rules'),
        model: project,
        sourceType: 'project',
        resultType: 'route',
        to: `/organizations/${orgId}/alerts/rules/?project=${project.id}`,
      },
    ];

    projectResults.unshift({
      title: t('%s Dashboard', project.slug),
      description: t('Project Details'),
      model: project,
      sourceType: 'project',
      resultType: 'route',
      to: `/organizations/${orgId}/projects/${project.slug}/?project=${project.id}`,
    });

    return projectResults;
  });
}
async function createTeamResults(
  teamsPromise: Promise<Team[]>,
  orgId?: string
): Promise<ResultItem[]> {
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

async function createMemberResults(
  membersPromise: Promise<Member[]>,
  orgId?: string
): Promise<ResultItem[]> {
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

async function createPluginResults(
  pluginsPromise: Promise<PluginWithProjectList[]>,
  orgId?: string
): Promise<ResultItem[]> {
  const plugins = (await pluginsPromise) || [];
  return plugins
    .filter(plugin => {
      // show a plugin if it is not hidden (aka legacy) or if we have projects with it configured
      return !plugin.isHidden || !!plugin.projectList.length;
    })
    .map(plugin => ({
      title: plugin.isHidden ? `${plugin.name} (Legacy)` : plugin.name,
      description: (
        <span
          dangerouslySetInnerHTML={{
            __html: markedSingleLine(plugin.description ?? ''),
          }}
        />
      ),
      model: plugin,
      sourceType: 'plugin',
      resultType: 'integration',
      to: `/settings/${orgId}/plugins/${plugin.id}/`,
    }));
}

async function createIntegrationResults(
  integrationsPromise: Promise<{providers: IntegrationProvider[]}>,
  orgId?: string
): Promise<ResultItem[]> {
  const {providers} = (await integrationsPromise) || {};
  return (
    providers?.map(provider => ({
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
      to: `/settings/${orgId}/integrations/${provider.slug}/`,
      configUrl: `/api/0/organizations/${orgId}/integrations/?provider_key=${provider.slug}&includeConfig=0`,
    })) || []
  );
}

async function createSentryAppResults(
  sentryAppPromise: Promise<SentryApp[]>,
  orgId?: string
): Promise<ResultItem[]> {
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
    resultType: 'sentryApp',
    to: `/settings/${orgId}/sentry-apps/${sentryApp.slug}/`,
  }));
}

async function createDocIntegrationResults(
  docIntegrationPromise: Promise<DocIntegration[]>,
  orgId?: string
): Promise<ResultItem[]> {
  const docIntegrations = (await docIntegrationPromise) || [];
  return docIntegrations.map(docIntegration => ({
    title: docIntegration.name,
    description: (
      <span
        dangerouslySetInnerHTML={{
          __html: markedSingleLine(docIntegration.description || ''),
        }}
      />
    ),
    model: docIntegration,
    sourceType: 'docIntegration',
    resultType: 'docIntegration',
    to: `/settings/${orgId}/document-integrations/${docIntegration.slug}/`,
  }));
}

async function createShortIdLookupResult(
  shortIdLookupPromise: Promise<ShortIdResponse>
): Promise<Result | null> {
  const shortIdLookup = await shortIdLookupPromise;
  if (!shortIdLookup) {
    return null;
  }

  const issue = shortIdLookup?.group;
  return {
    item: {
      title: `${issue?.metadata?.type || shortIdLookup.shortId}`,
      description: `${issue?.metadata?.value || t('Issue')}`,
      model: shortIdLookup.group,
      sourceType: 'issue',
      resultType: 'issue',
      to: `/${shortIdLookup.organizationSlug}/${shortIdLookup.projectSlug}/issues/${shortIdLookup.groupId}/`,
    },
    score: 1,
    refIndex: 0,
  };
}

async function createEventIdLookupResult(
  eventIdLookupPromise: Promise<EventIdResponse>
): Promise<Result | null> {
  const eventIdLookup = await eventIdLookupPromise;
  if (!eventIdLookup) {
    return null;
  }

  const event = eventIdLookup?.event;
  return {
    item: {
      title: `${event?.metadata?.type || t('Event')}`,
      description: `${event?.metadata?.value}`,
      sourceType: 'event',
      resultType: 'event',
      to: `/${eventIdLookup.organizationSlug}/${eventIdLookup.projectSlug}/issues/${eventIdLookup.groupId}/events/${eventIdLookup.eventId}/`,
    },
    score: 1,
    refIndex: 0,
  };
}

type Props = WithRouterProps<{}> & {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  organization?: Organization;
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.IFuseOptions<ResultItem>;
};

type State = {
  directResults: null | Result[];
  fuzzy: null | Fuse<ResultItem>;
  loading: boolean;
  searchResults: null | Result[];
};

class ApiSource extends Component<Props, State> {
  static defaultProps = {
    searchOptions: {},
  };

  state: State = {
    loading: false,
    searchResults: null,
    directResults: null,
    fuzzy: null,
  };

  componentDidMount() {
    if (typeof this.props.query !== 'undefined') {
      this.doSearch(this.props.query);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    // Limit the number of times we perform API queries by only attempting API queries
    // using first two characters, otherwise perform in-memory search.
    //
    // Otherwise it'd be constant :spinning_loading_wheel:
    if (
      (nextProps.query.length <= 2 &&
        nextProps.query.substring(0, 2) !== this.props.query.substring(0, 2)) ||
      // Also trigger a search if next query value satisfies an eventid/shortid query
      shouldSearchShortIds(nextProps.query) ||
      shouldSearchEventIds(nextProps.query)
    ) {
      this.setState({loading: true});
      this.doSearch(nextProps.query);
    }
  }

  api = new Client();

  // Debounced method to handle querying all API endpoints (when necessary)
  doSearch = debounce((query: string) => {
    const {organization} = this.props;
    const orgId = organization?.slug;

    let searchUrls: string[] = [];
    let directUrls: (string | null)[] = [];

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
        '/doc-integrations/',
      ];

      directUrls = [
        shouldSearchShortIds(query) ? `/organizations/${orgId}/shortids/${query}/` : null,
        shouldSearchEventIds(query) ? `/organizations/${orgId}/eventids/${query}/` : null,
      ];
    }
    let searchRequests = [fetchOrganizations(this.api, {query})];
    searchRequests = searchRequests.concat(
      searchUrls.map(url =>
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
      )
    );

    const directRequests = directUrls.map(url => {
      if (!url) {
        return Promise.resolve(null);
      }

      return this.api.requestPromise(url).then(
        resp => resp,
        (err: ResponseMeta) => {
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

  handleRequestError = (err: ResponseMeta, {url, orgId}) => {
    if (err && err.status !== 401 && err.status !== 403) {
      Sentry.withScope(scope => {
        scope.setExtra(
          'url',
          url.replace(`/organizations/${orgId}/`, '/organizations/:orgId/')
        );
        scope.setFingerprint(['api-source-failed']);
        Sentry.captureException(err);
      });
    }
  };

  // Handles a list of search request promises, and then updates state with response objects
  async handleSearchRequest(
    searchRequests: Promise<ResultItem[]>[],
    directRequests: Promise<Result | null>[]
  ) {
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
      docIntegrations,
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
        docIntegrations,
      ]),
      this.getDirectResults([shortIdLookup, eventIdLookup]),
    ]);

    // TODO(XXX): Might consider adding logic to maintain consistent ordering
    // of results so things don't switch positions
    const fuzzy = await createFuzzySearch(searchResults, {
      ...searchOptions,
      keys: ['title', 'description'],
      getFn: strGetFn,
    });

    this.setState({
      loading: false,
      fuzzy,
      directResults,
    });
  }

  // Process API requests that create result objects that should be searchable
  async getSearchableResults(requests: Promise<any>[]) {
    const {organization} = this.props;
    const orgId = organization?.slug;

    const [
      organizations,
      projects,
      teams,
      members,
      plugins,
      integrations,
      sentryApps,
      docIntegrations,
    ] = requests;
    const searchResults = await Promise.all([
      createOrganizationResults(organizations),
      createProjectResults(projects, orgId),
      createTeamResults(teams, orgId),
      createMemberResults(members, orgId),
      createIntegrationResults(integrations, orgId),
      createPluginResults(plugins, orgId),
      createSentryAppResults(sentryApps, orgId),
      createDocIntegrationResults(docIntegrations, orgId),
    ]);

    return searchResults.flat();
  }

  // Create result objects from API requests that do not require fuzzy search
  // i.e. these responses only return 1 object or they should always be displayed regardless of query input
  async getDirectResults(requests: Promise<any>[]): Promise<Result[]> {
    const [shortIdLookup, eventIdLookup] = requests;

    const directResults = (
      await Promise.all([
        createShortIdLookupResult(shortIdLookup),
        createEventIdLookupResult(eventIdLookup),
      ])
    ).filter(defined);

    if (!directResults.length) {
      return [];
    }

    return directResults;
  }

  render() {
    const {children, query} = this.props;
    const {fuzzy, directResults} = this.state;
    const results = fuzzy?.search(query) ?? [];

    return children({
      isLoading: this.state.loading,
      results: [results, directResults].flat().filter(defined),
    });
  }
}

export {ApiSource};
export default withLatestContext(withSentryRouter(ApiSource));
