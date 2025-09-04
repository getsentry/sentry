import {useCallback, useEffect, useState} from 'react';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {EventIdResponse} from 'sentry/types/event';
import type {ShortIdResponse} from 'sentry/types/group';
import type {
  DocIntegration,
  IntegrationProvider,
  PluginWithProjectList,
  SentryApp,
} from 'sentry/types/integrations';
import type {Member, Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {singleLineRenderer as markedSingleLine} from 'sentry/utils/marked/marked';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

import type {ChildProps, ResultItem} from './types';
import {makeResolvedTs, strGetFn} from './utils';

// event ids must have string length of 32
const shouldSearchEventIds = (query?: string) =>
  typeof query === 'string' && query.length === 32;

// STRING-HEXVAL
const shouldSearchShortIds = (query: string) => /[\w\d]+-[\w\d]+/.test(query);

export async function createProjectResults(
  projectsPromise: Promise<Project[]>,
  organization?: Organization
): Promise<ResultItem[]> {
  const projects = (await projectsPromise) || [];
  const resolvedTs = makeResolvedTs();

  if (!organization) {
    return [];
  }

  return projects.flatMap(project => {
    const projectResults: ResultItem[] = [
      {
        title: t('%s Settings', project.slug),
        description: t('Project Settings'),
        model: project,
        sourceType: 'project',
        resultType: 'settings',
        to: `/settings/${organization.slug}/projects/${project.slug}/`,
        resolvedTs,
      },
      {
        title: t('%s Alerts', project.slug),
        description: t('List of project alert rules'),
        model: project,
        sourceType: 'project',
        resultType: 'route',
        to:
          makeAlertsPathname({
            path: '/rules/',
            organization,
          }) + `?project=${project.id}`,
        resolvedTs,
      },
    ];

    projectResults.unshift({
      title: t('%s Dashboard', project.slug),
      description: t('Project Details'),
      model: project,
      sourceType: 'project',
      resultType: 'route',
      to:
        makeProjectsPathname({
          organization,
          path: `/${project.slug}/`,
        }) + `?project=${project.id}`,
      resolvedTs,
    });

    return projectResults;
  });
}
export async function createTeamResults(
  teamsPromise: Promise<Team[]>,
  org: Organization
): Promise<ResultItem[]> {
  const teams = (await teamsPromise) || [];
  const resolvedTs = makeResolvedTs();

  return teams.map(team => ({
    title: `#${team.slug}`,
    description: 'Team Settings',
    model: team,
    sourceType: 'team',
    resultType: 'settings',
    to: `/settings/${org.slug}/teams/${team.slug}/`,
    resolvedTs,
  }));
}

export async function createMemberResults(
  membersPromise: Promise<Member[]>,
  org: Organization
): Promise<ResultItem[]> {
  const members = (await membersPromise) || [];
  const resolvedTs = makeResolvedTs();

  return members.map(member => ({
    title: member.name,
    description: member.email,
    model: member,
    sourceType: 'member',
    resultType: 'settings',
    to: `/settings/${org.slug}/members/${member.id}/`,
    resolvedTs,
  }));
}

export async function createPluginResults(
  pluginsPromise: Promise<PluginWithProjectList[]>,
  org: Organization
): Promise<ResultItem[]> {
  const plugins = (await pluginsPromise) || [];
  const resolvedTs = makeResolvedTs();

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
      to: `/settings/${org.slug}/plugins/${plugin.id}/`,
      resolvedTs,
    }));
}

export async function createIntegrationResults(
  integrationsPromise: Promise<{providers: IntegrationProvider[]}>,
  org: Organization
): Promise<ResultItem[]> {
  const {providers} = (await integrationsPromise) || {};
  const resolvedTs = makeResolvedTs();

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
      to: `/settings/${org.slug}/integrations/${provider.slug}/`,
      configUrl: `/api/0/organizations/${org.slug}/integrations/?provider_key=${provider.slug}&includeConfig=0`,
      resolvedTs,
    })) || []
  );
}

export async function createSentryAppResults(
  sentryAppPromise: Promise<SentryApp[]>,
  org: Organization
): Promise<ResultItem[]> {
  const sentryApps = (await sentryAppPromise) || [];
  const resolvedTs = makeResolvedTs();

  return sentryApps.map(sentryApp => ({
    title: sentryApp.name,
    description: (
      <span
        dangerouslySetInnerHTML={{
          __html: markedSingleLine(sentryApp.overview ?? ''),
        }}
      />
    ),
    model: sentryApp,
    sourceType: 'sentryApp',
    resultType: 'sentryApp',
    to: `/settings/${org.slug}/sentry-apps/${sentryApp.slug}/`,
    resolvedTs,
  }));
}

export async function createDocIntegrationResults(
  docIntegrationPromise: Promise<DocIntegration[]>,
  org: Organization
): Promise<ResultItem[]> {
  const docIntegrations = (await docIntegrationPromise) || [];
  const resolvedTs = makeResolvedTs();

  return docIntegrations.map(docIntegration => ({
    title: docIntegration.name,
    description: (
      <span
        dangerouslySetInnerHTML={{
          __html: markedSingleLine(docIntegration.description ?? ''),
        }}
      />
    ),
    model: docIntegration,
    sourceType: 'docIntegration',
    resultType: 'docIntegration',
    to: `/settings/${org.slug}/document-integrations/${docIntegration.slug}/`,
    resolvedTs,
  }));
}

async function createShortIdResult(
  shortIdLookupPromise: Promise<ShortIdResponse>
): Promise<ResultItem[] | null> {
  const shortIdLookup = await shortIdLookupPromise;
  const resolvedTs = makeResolvedTs();

  if (!shortIdLookup) {
    return null;
  }

  const issue = shortIdLookup?.group;
  return [
    {
      title: `${issue?.metadata?.type ?? shortIdLookup.shortId}`,
      description: `${issue?.metadata?.value ?? t('Issue')}`,
      model: shortIdLookup.group,
      sourceType: 'issue',
      resultType: 'issue',
      to: `/${shortIdLookup.organizationSlug}/${shortIdLookup.projectSlug}/issues/${shortIdLookup.groupId}/`,
      resolvedTs,
    },
  ];
}

async function createEventIdResult(
  eventIdLookupPromise: Promise<EventIdResponse>
): Promise<ResultItem[] | null> {
  const eventIdLookup = await eventIdLookupPromise;
  const resolvedTs = makeResolvedTs();

  if (!eventIdLookup) {
    return null;
  }

  const event = eventIdLookup?.event;
  return [
    {
      title: `${event?.metadata?.type ?? t('Event')}`,
      description: event?.metadata?.value,
      model: event,
      sourceType: 'event',
      resultType: 'event',
      to: `/${eventIdLookup.organizationSlug}/${eventIdLookup.projectSlug}/issues/${eventIdLookup.groupId}/events/${eventIdLookup.eventId}/`,
      resolvedTs,
    },
  ];
}

interface Props {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  /**
   * How long to wait for debouncing the query for API requests
   */
  debounceDuration?: number;
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.IFuseOptions<ResultItem>;
}

export async function queryResults(
  api: Client,
  url: string,
  query?: string,
  limit?: number
): Promise<any | null> {
  try {
    return await api.requestPromise(
      url,
      query === undefined ? {} : {query: {query, per_page: limit}}
    );
  } catch {
    return null;
  }
}

function ApiSource({children, query, searchOptions, debounceDuration}: Props) {
  const api = useApi();
  const organization = useOrganization({allowNull: true});

  const debouncedQuery = useDebouncedValue(query, debounceDuration);

  // Only search the first two letters (when it's not a direct query) since
  // otherwise we'll just end up constantly querying the backend and not get
  // fuzzy-search advnatages.
  const apiQuery =
    shouldSearchShortIds(debouncedQuery) || shouldSearchEventIds(debouncedQuery)
      ? debouncedQuery
      : debouncedQuery.slice(0, 2);

  const [apiResults, setApiResults] = useState<ResultItem[]>([]);
  const [isLoading, setLoading] = useState(true);

  const [results, setResults] = useState<Array<Fuse.FuseResult<ResultItem>>>([]);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    const pendingResults: Array<Promise<ResultItem[] | null>> = [];

    if (organization) {
      const org = organization;
      const slug = organization.slug;

      const q = (url: string) => queryResults(api, url, apiQuery);
      const d = (url: string) => queryResults(api, url);

      const searchQueries = [
        createProjectResults(q(`/organizations/${slug}/projects/`), org),
        createTeamResults(q(`/organizations/${slug}/teams/`), org),
        createMemberResults(q(`/organizations/${slug}/members/`), org),
        createPluginResults(q(`/organizations/${slug}/plugins/configs/`), org),
        createIntegrationResults(q(`/organizations/${slug}/config/integrations/`), org),
        createSentryAppResults(q('/sentry-apps/?status=published'), org),
        createDocIntegrationResults(q('/doc-integrations/'), org),
      ] as const;
      pendingResults.push(...searchQueries);

      if (shouldSearchEventIds(apiQuery)) {
        pendingResults.push(
          createEventIdResult(d(`/organizations/${slug}/eventids/${apiQuery}/`))
        );
      }

      if (shouldSearchShortIds(apiQuery)) {
        pendingResults.push(
          createShortIdResult(d(`/organizations/${slug}/shortids/${apiQuery}/`))
        );
      }
    }

    const resolvedResults = await Promise.all(pendingResults);
    setApiResults(resolvedResults.flat().filter(i => i !== null));
    setLoading(false);
  }, [api, apiQuery, organization]);

  const handleFuzzySearch = useCallback(async () => {
    const fuzzy = await createFuzzySearch(apiResults, {
      ...searchOptions,
      keys: ['title', 'description', 'model.id', 'model.shortId'],
      getFn: strGetFn,
    });
    setResults(fuzzy.search(query));
  }, [apiResults, query, searchOptions]);

  useEffect(() => void handleSearch(), [handleSearch]);
  useEffect(() => void handleFuzzySearch(), [handleFuzzySearch]);

  return children({results, isLoading});
}

export default ApiSource;
