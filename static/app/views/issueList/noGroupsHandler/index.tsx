import {lazy, Suspense} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {NoIssuesMatched} from 'sentry/views/issueList/noGroupsHandler/noIssuesMatched';
import {DEFAULT_QUERY, FOR_REVIEW_QUERIES} from 'sentry/views/issueList/utils';

import {NoUnresolvedIssues} from './noUnresolvedIssues';

const WaitingForEvents = lazy(() => import('sentry/components/waitingForEvents'));
const UpdatedEmptyState = lazy(() => import('sentry/components/updatedEmptyState'));

interface NoGroupsHandlerProps {
  groupIds: string[];
  organization: Organization;
  query: string;
  selectedProjectIds: number[];
  emptyMessage?: React.ReactNode;
}

interface SentFirstEventResponse {
  sentFirstEvent: boolean;
}

interface EmptyResultProps {
  query: string;
  emptyMessage?: React.ReactNode;
}

const UPDATED_EMPTY_STATE_PLATFORMS = new Set([
  'python-django',
  'node',
  'javascript-nextjs',
  'android',
  'apple-ios',
  'dotnet',
  'dotnet-aspnetcore',
  'flutter',
  'go',
  'java',
  'java-spring-boot',
  'javascript',
  'javascript-angular',
  'javascript-react',
  'javascript-vue',
  'node-express',
  'node-nestjs',
  'php',
  'php-laravel',
  'python',
  'python-fastapi',
  'python-flask',
  'react-native',
  'ruby',
  'ruby-rails',
  'unity',
]);

/**
 * Component which is rendered when no groups/issues were found. This could
 * either be caused by having no first events, having resolved all issues, or
 * having no issues be returned from a query. This component will conditionally
 * render one of those states.
 */
export function NoGroupsHandler({
  emptyMessage,
  groupIds,
  organization,
  query,
  selectedProjectIds,
}: NoGroupsHandlerProps) {
  // If no projects are selected, then we must check every project the user is a
  // member of and make sure there are no first events for all of the projects.
  // Set project to -1 for all projects. Do not pass a project id for "my projects".
  const explicitSelectedProjectIds =
    selectedProjectIds.length && !selectedProjectIds.includes(ALL_ACCESS_PROJECTS)
      ? selectedProjectIds
      : undefined;
  const selectedProjectQuery = explicitSelectedProjectIds
    ?.map(id => `id:${id}`)
    .join(' ');

  const sentFirstEventQuery = useQuery({
    ...apiOptions.as<SentFirstEventResponse>()(
      '/organizations/$organizationIdOrSlug/sent-first-event/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {project: explicitSelectedProjectIds},
        staleTime: 0,
      }
    ),
    retry: false,
  });

  const shouldFetchProject = sentFirstEventQuery.data?.sentFirstEvent === false;

  const projectsQuery = useQuery({
    ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
      path: shouldFetchProject ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        collapse: ['latestDeploys', 'unusedFeatures'],
        per_page: 1,
        query: selectedProjectQuery,
      },
      staleTime: 0,
    }),
    retry: false,
  });

  if (sentFirstEventQuery.isPending || (shouldFetchProject && projectsQuery.isPending)) {
    return <LoadingIndicator />;
  }

  if (sentFirstEventQuery.isError || (shouldFetchProject && projectsQuery.isError)) {
    return <EmptyResult emptyMessage={emptyMessage} query={query} />;
  }

  if (!sentFirstEventQuery.data?.sentFirstEvent) {
    return (
      <AwaitingEvents
        groupIds={groupIds}
        organization={organization}
        projects={projectsQuery.data ?? []}
      />
    );
  }

  return <EmptyResult emptyMessage={emptyMessage} query={query} />;
}

interface AwaitingEventsProps {
  groupIds: string[];
  organization: Organization;
  projects: Project[];
}

function AwaitingEvents({groupIds, organization, projects}: AwaitingEventsProps) {
  const project = projects?.[0];
  const sampleIssueId = groupIds.length > 0 ? groupIds[0] : undefined;

  const hasUpdatedEmptyState =
    project?.platform && UPDATED_EMPTY_STATE_PLATFORMS.has(project.platform);

  return (
    <Suspense fallback={<Placeholder height="260px" />}>
      {!hasUpdatedEmptyState && (
        <WaitingForEvents
          org={organization}
          project={project}
          sampleIssueId={sampleIssueId}
        />
      )}
      {hasUpdatedEmptyState && <UpdatedEmptyState project={project} />}
    </Suspense>
  );
}

function EmptyResult({emptyMessage, query}: EmptyResultProps) {
  if (query === DEFAULT_QUERY) {
    return (
      <NoUnresolvedIssues
        title={t("We couldn't find any issues that matched your filters.")}
        subtitle={t('Get out there and write some broken code!')}
      />
    );
  }

  if (FOR_REVIEW_QUERIES.includes(query || '')) {
    return (
      <NoUnresolvedIssues
        title={t('Well, would you look at that.')}
        subtitle={t(
          'No more issues to review. Better get back out there and write some broken code.'
        )}
      />
    );
  }

  if (emptyMessage) {
    return (
      <EmptyStateWarning>
        <p>{emptyMessage}</p>
      </EmptyStateWarning>
    );
  }

  return <NoIssuesMatched />;
}
