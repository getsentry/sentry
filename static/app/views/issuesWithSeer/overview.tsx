import {useCallback, useEffect, useMemo, useState} from 'react';

import {Text} from '@sentry/scraps/text';

import {
  AutofixStepType,
  type AutofixChangesStep,
  type AutofixData,
} from 'sentry/components/events/autofix/types';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import IssueListFilters from 'sentry/views/issueList/filters';
import {
  DEFAULT_ISSUE_STREAM_SORT,
  type IssueSortOptions,
} from 'sentry/views/issueList/utils';
import {IssuesWithSeerTable} from 'sentry/views/issuesWithSeer/table';
import type {IssueWithSeer} from 'sentry/views/issuesWithSeer/types';

function parseSeerState(seerResponse: {autofix?: AutofixData | null}): {
  hasCodeChanges: boolean;
  hasPR: boolean;
  hasRCA: boolean;
  hasSolution: boolean;
  prLinks: string[];
  seerState: AutofixData | null;
} {
  const seerState = seerResponse?.autofix ?? null;

  if (!seerState) {
    return {
      hasRCA: false,
      hasSolution: false,
      hasCodeChanges: false,
      hasPR: false,
      prLinks: [],
      seerState: null,
    };
  }

  // Issue has RCA if autofix state exists (not null)
  const hasRCA = true;

  // Check if solution_processing step exists in steps array
  const hasSolution =
    seerState.steps?.some(
      step => step.key === 'solution_processing' || step.key === 'solution'
    ) ?? false;

  // Check if changes step exists in steps array
  const hasCodeChanges =
    seerState.steps?.some(step => step.key === 'changes' || step.key === 'plan') ?? false;

  // Extract PR links from the changes step's pull_request field
  const prLinks: string[] = [];
  const changesStep = seerState.steps?.find(
    step => step.type === AutofixStepType.CHANGES
  ) as AutofixChangesStep;
  if (changesStep?.changes?.[0]?.pull_request?.pr_url) {
    prLinks.push(changesStep.changes?.[0]?.pull_request?.pr_url);
  }

  const hasPR = prLinks.length > 0;

  return {hasRCA, hasSolution, hasCodeChanges, hasPR, prLinks, seerState};
}

export default function IssuesWithSeerOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  const [enrichedIssues, setEnrichedIssues] = useState<IssueWithSeer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Search and sort state from URL
  const query = (location.query.query as string) || '';
  const sort = (location.query.sort as IssueSortOptions) || DEFAULT_ISSUE_STREAM_SORT;

  // Stable stringified versions of selection arrays for dependency tracking
  const projectsKey = useMemo(() => selection.projects.join(','), [selection.projects]);
  const environmentsKey = useMemo(
    () => selection.environments.join(','),
    [selection.environments]
  );
  const datetimeKey = useMemo(
    () => JSON.stringify(selection.datetime),
    [selection.datetime]
  );

  // Handlers for search and sort
  const onSearch = useCallback(
    (newQuery: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          query: newQuery,
          cursor: undefined, // Reset pagination on search
        },
      });
    },
    [location, navigate]
  );

  const onSortChange = useCallback(
    (newSort: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          sort: newSort,
          cursor: undefined, // Reset pagination on sort change
        },
      });
    },
    [location, navigate]
  );

  // Fetch and enrich issues
  const fetchIssuesWithSeer = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      // Fetch one page of issues (25) with the filter
      const params = new URLSearchParams();

      if (query) {
        params.set('query', query);
      }
      params.set('sort', sort);
      params.set('limit', '25');

      if (selection.projects.length > 0) {
        selection.projects.forEach(project => {
          params.append('project', String(project));
        });
      }

      if (selection.environments.length > 0) {
        selection.environments.forEach(env => {
          params.append('environment', env);
        });
      }

      const issuesResponse = await fetch(
        `/api/0/organizations/${organization.slug}/issues/?${params.toString()}`,
        {credentials: 'include'}
      );

      if (!issuesResponse.ok) {
        throw new Error('Failed to fetch issues');
      }

      const issues: Group[] = await issuesResponse.json();

      // Enrich all issues with Seer data in parallel
      const enrichedData: IssueWithSeer[] = await Promise.all(
        issues.map(async issue => {
          try {
            const autofixResponse = await fetch(
              `/api/0/organizations/${organization.slug}/issues/${issue.id}/autofix/`,
              {credentials: 'include'}
            );

            if (autofixResponse.ok) {
              const data = await autofixResponse.json();
              const {hasRCA, hasSolution, hasCodeChanges, hasPR, prLinks, seerState} =
                parseSeerState(data);

              return {
                issue,
                automation: {
                  seerState,
                  hasRCA,
                  hasSolution,
                  hasCodeChanges,
                  hasPR,
                  prLinks,
                },
              };
            }
          } catch (error) {
            // Silently handle errors, return issue without Seer data
          }

          // If autofix endpoint fails or errors, return issue without Seer data
          return {
            issue,
            automation: {
              seerState: null,
              hasRCA: false,
              hasSolution: false,
              hasCodeChanges: false,
              hasPR: false,
              prLinks: [],
            },
          };
        })
      );

      setEnrichedIssues(enrichedData);
    } catch (error) {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization.slug, query, sort]);

  // Fetch when query, sort, or selection changes
  useEffect(() => {
    fetchIssuesWithSeer();
  }, [fetchIssuesWithSeer, projectsKey, environmentsKey, datetimeKey]);

  return (
    <SentryDocumentTitle title={t('Highly Actionable Issues')}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Issues with Seer Analysis')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main width="full">
            <IssueListFilters
              query={query}
              sort={sort}
              onSearch={onSearch}
              onSortChange={onSortChange}
            />

            {hasError ? (
              <Text variant="danger">
                {t('Failed to load issues. Please try again later.')}
              </Text>
            ) : (
              <IssuesWithSeerTable issues={enrichedIssues} loading={isLoading} />
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
