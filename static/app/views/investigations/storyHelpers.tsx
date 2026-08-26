import {useEffect, useMemo, type ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

import type {ApiResult, ResponseMeta} from 'sentry/types/api';
import type {GroupOpenPeriod} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {openPeriodsApiOptions} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {
  getInvestigationDetailQueryOptions,
  investigationCandidatesQueryOptions,
  investigationExecutionDetailQueryOptions,
  investigationListQueryOptions,
  investigationTitleGenerationQueryOptions,
} from 'sentry/views/investigations/api';
import type {
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationListItem,
  InvestigationTitleGeneration,
  MetricOpenPeriodInvestigationSource,
} from 'sentry/views/investigations/types';

type StoryApiResponse = {
  body: unknown;
  headers?: Record<string, string>;
  statusCode?: number;
};

/**
 * Offline storybook helper: route investigation API traffic to fixture bodies so
 * list/detail pages and polling paths work without a backend.
 */
export function installInvestigationsStoryApi(
  responses: Array<{response: StoryApiResponse; url: string; method?: string}>
) {
  const original = QUERY_API_CLIENT.requestPromise.bind(QUERY_API_CLIENT);

  QUERY_API_CLIENT.requestPromise = ((path: string, options: any) => {
    const method = (options.method || (options.data ? 'POST' : 'GET')).toUpperCase();
    const match = responses.find(entry => {
      const entryMethod = (entry.method ?? 'GET').toUpperCase();
      return entryMethod === method && path.startsWith(entry.url);
    });

    if (!match) {
      // Keep mutations/no-op GETs from breaking unrelated scrap chrome.
      if (method === 'GET') {
        return Promise.reject(new Error(`No investigation story fixture for GET ${path}`));
      }
      return Promise.resolve(options.includeAllArgs ? [{}, 'success', emptyResponseMeta()] : {});
    }

    const statusCode = match.response.statusCode ?? 200;
    const headers = match.response.headers ?? {};
    const meta = responseMeta(statusCode, headers);

    if (statusCode >= 400) {
      return Promise.reject(Object.assign(new Error('Story API error'), meta));
    }

    if (options.includeAllArgs) {
      return Promise.resolve([match.response.body, 'success', meta] as ApiResult);
    }
    return Promise.resolve(match.response.body);
  }) as typeof QUERY_API_CLIENT.requestPromise;

  return () => {
    QUERY_API_CLIENT.requestPromise = original;
  };
}

function emptyResponseMeta(): ResponseMeta {
  return responseMeta(200, {});
}

function responseMeta(status: number, headers: Record<string, string>): ResponseMeta {
  return {
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    responseJSON: null,
    responseText: '',
    getResponseHeader: (header: string) => headers[header] ?? null,
  };
}

export function makeInvestigationsStoryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function seedInvestigationList(
  queryClient: QueryClient,
  organizationSlug: string,
  items: InvestigationListItem[],
  headers: Record<string, string> = {}
) {
  queryClient.setQueryData(
    investigationListQueryOptions({organizationSlug}).queryKey,
    {json: items, headers}
  );
}

export function seedInvestigationDetail(
  queryClient: QueryClient,
  organizationSlug: string,
  investigation: InvestigationDetail
) {
  queryClient.setQueryData(
    getInvestigationDetailQueryOptions(organizationSlug, investigation.id).queryKey,
    {json: investigation, headers: {}}
  );
}

export function seedInvestigationTitleGeneration(
  queryClient: QueryClient,
  organizationSlug: string,
  investigationId: string,
  titleGeneration: InvestigationTitleGeneration
) {
  queryClient.setQueryData(
    investigationTitleGenerationQueryOptions(organizationSlug, investigationId).queryKey,
    {json: titleGeneration, headers: {}}
  );
}

export function seedInvestigationExecution(
  queryClient: QueryClient,
  organizationSlug: string,
  investigationId: string,
  blockId: string,
  execution: InvestigationExecutionDetail
) {
  queryClient.setQueryData(
    investigationExecutionDetailQueryOptions({
      organizationSlug,
      investigationId,
      blockId,
      executionId: execution.id,
    }).queryKey,
    {json: execution, headers: {}}
  );
}

export function seedInvestigationCandidates(
  queryClient: QueryClient,
  organizationSlug: string,
  sources: MetricOpenPeriodInvestigationSource[],
  items: Array<{status: 'investigate' | 'unavailable' | 'view'; investigationId?: string}>
) {
  queryClient.setQueryData(
    investigationCandidatesQueryOptions({organizationSlug, sources}).queryKey,
    {json: {items}, headers: {}}
  );
}

export function seedOpenPeriods(
  queryClient: QueryClient,
  organization: Organization,
  params: {groupId: string; eventId?: string; limit?: number},
  openPeriods: GroupOpenPeriod[]
) {
  queryClient.setQueryData(
    openPeriodsApiOptions({organization, ...params}).queryKey,
    {json: openPeriods, headers: {}}
  );
}

type InvestigationsOrgOptions = {
  features?: string[];
  openMembership?: boolean;
};

export function InvestigationsStoryOrganization({
  children,
  features = ['investigations'],
  openMembership = true,
}: InvestigationsOrgOptions & {children: ReactNode}) {
  const organization = useOrganization();
  const value = useMemo(() => {
    const nextFeatures = organization.features.filter(
      feature => feature !== 'investigations'
    );
    for (const feature of features) {
      if (!nextFeatures.includes(feature)) {
        nextFeatures.push(feature);
      }
    }
    return {
      ...organization,
      features: nextFeatures,
      openMembership,
    };
  }, [features, openMembership, organization]);

  return (
    <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
  );
}

type SeedFn = (queryClient: QueryClient, organization: Organization) => void;

type StoryApiRoute = {
  response: StoryApiResponse;
  url: string;
  method?: string;
};

export function InvestigationsStoryProviders({
  children,
  seed,
  apiResponses = [],
  features = ['investigations'],
  openMembership = true,
  route,
  initialPath,
}: {
  children: ReactNode;
  apiResponses?: StoryApiRoute[];
  features?: string[];
  /**
   * Optional nested route path, e.g. `/organizations/:orgId/seer/investigation/:investigationId/`
   */
  initialPath?: string;
  openMembership?: boolean;
  route?: string;
  seed?: SeedFn;
}) {
  const organization = useOrganization();
  const queryClient = useMemo(() => {
    const client = makeInvestigationsStoryQueryClient();
    seed?.(client, {
      ...organization,
      features: features.includes('investigations')
        ? organization.features.includes('investigations')
          ? organization.features
          : [...organization.features, 'investigations']
        : organization.features.filter(feature => feature !== 'investigations'),
      openMembership,
    });
    return client;
    // Seed once for the story instance; stories are static fixtures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (apiResponses.length === 0) {
      return;
    }
    return installInvestigationsStoryApi(apiResponses);
  }, [apiResponses]);

  const content = (
    <InvestigationsStoryOrganization features={features} openMembership={openMembership}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </InvestigationsStoryOrganization>
  );

  if (!route || !initialPath) {
    return content;
  }

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={route} element={content} />
      </Routes>
    </MemoryRouter>
  );
}
