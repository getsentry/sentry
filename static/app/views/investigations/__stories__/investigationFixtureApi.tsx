import {useEffect, useState, type ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import type {RequestOptions} from 'sentry/api';
import type {ResponseMeta} from 'sentry/types/api';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {DEFAULT_QUERY_CLIENT_CONFIG, QUERY_API_CLIENT} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
  InvestigationDetailFixture,
  InvestigationExecutionDetailFixture,
  InvestigationQueryOutputFixture,
  InvestigationTranscriptBlockFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationListItem,
  InvestigationTitleGeneration,
} from 'sentry/views/investigations/types';

type FixtureApiMode = 'success' | 'loading' | 'error';

type InvestigationFixtureApiProps = {
  children: ReactNode;
  organizationSlug: string;
  details?: InvestigationDetail[];
  executions?: Record<string, InvestigationExecutionDetail>;
  featureEnabled?: boolean;
  list?: InvestigationListItem[];
  mode?: FixtureApiMode;
  openMembership?: boolean;
  pageLinks?: string;
  titleGenerations?: Record<string, InvestigationTitleGeneration>;
};

type FixtureApiConfig = Omit<InvestigationFixtureApiProps, 'children'>;

type FixtureResponse = {
  body: unknown;
  headers?: Record<string, string>;
};

type FixtureHandlerResult = Promise<FixtureResponse> | typeof NO_MATCH;
type FixtureHandler = (
  path: string,
  options: Readonly<RequestOptions> & {includeAllArgs?: boolean}
) => FixtureHandlerResult;

type RequestPromise = typeof QUERY_API_CLIENT.requestPromise;

const NO_MATCH = Symbol('NO_MATCH');
const fixtureHandlers = new Map<string, FixtureHandler>();
let originalRequestPromise: RequestPromise | null = null;

export function investigationExecutionFixtureKey(blockId: string, executionId: string) {
  return `${blockId}:${executionId}`;
}

export function InvestigationFixtureApi({
  children,
  organizationSlug,
  details = [],
  executions = {},
  featureEnabled = true,
  list = [],
  mode = 'success',
  openMembership = true,
  pageLinks,
  titleGenerations = {},
}: InvestigationFixtureApiProps) {
  const outerOrganization = useOrganization();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        ...DEFAULT_QUERY_CLIENT_CONFIG,
        defaultOptions: {
          ...DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions,
          queries: {
            ...DEFAULT_QUERY_CLIENT_CONFIG.defaultOptions?.queries,
            retry: false,
          },
        },
      })
  );
  const [handler] = useState(() =>
    createFixtureHandler({
      organizationSlug,
      details,
      executions,
      featureEnabled,
      list,
      mode,
      openMembership,
      pageLinks,
      titleGenerations,
    })
  );
  const [ready, setReady] = useState(false);
  const organization = {
    ...outerOrganization,
    slug: organizationSlug,
    features: featureEnabled
      ? Array.from(new Set([...outerOrganization.features, 'investigations']))
      : outerOrganization.features.filter(feature => feature !== 'investigations'),
    openMembership,
  };

  useEffect(() => {
    registerFixtureHandler(organizationSlug, handler);
    setReady(true);

    return () => {
      queryClient.clear();
      unregisterFixtureHandler(organizationSlug);
    };
  }, [handler, organizationSlug, queryClient]);

  if (!ready) {
    return null;
  }

  return (
    <OrganizationContext value={organization}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OrganizationContext>
  );
}

function registerFixtureHandler(key: string, handler: FixtureHandler) {
  if (fixtureHandlers.size === 0) {
    originalRequestPromise = QUERY_API_CLIENT.requestPromise;
    QUERY_API_CLIENT.requestPromise = fixtureRequestPromise;
  }
  fixtureHandlers.set(key, handler);
}

function unregisterFixtureHandler(key: string) {
  fixtureHandlers.delete(key);
  if (fixtureHandlers.size === 0 && originalRequestPromise) {
    QUERY_API_CLIENT.requestPromise = originalRequestPromise;
    originalRequestPromise = null;
  }
}

const fixtureRequestPromise = (async (
  path: string,
  options?: Readonly<RequestOptions> & {includeAllArgs?: boolean}
) => {
  const requestOptions = options ?? {};
  for (const handler of fixtureHandlers.values()) {
    const result = handler(path, requestOptions);
    if (result === NO_MATCH) {
      continue;
    }

    const {body, headers = {}} = await result;
    if (!requestOptions.includeAllArgs) {
      return body;
    }

    const response: ResponseMeta = {
      status: 200,
      statusText: 'OK',
      responseJSON: body,
      responseText: body === undefined ? '' : JSON.stringify(body),
      getResponseHeader: header => headers[header] ?? null,
    };
    return [body, 'success', response];
  }

  if (!originalRequestPromise) {
    throw new Error(`No API client is available for ${path}.`);
  }
  return originalRequestPromise.call(QUERY_API_CLIENT, path, requestOptions);
}) as RequestPromise;

function createFixtureHandler(config: FixtureApiConfig): FixtureHandler {
  const basePath = `/organizations/${config.organizationSlug}/investigations/`;
  const state = createFixtureState(config);

  return (path, options) => {
    if (!path.startsWith(basePath)) {
      return NO_MATCH;
    }
    if (config.mode === 'loading') {
      return new Promise(() => {});
    }
    if (config.mode === 'error') {
      const method = normalizeMethod(options.method);
      const response: ResponseMeta = {
        status: 500,
        statusText: 'Internal Server Error',
        responseJSON: {detail: 'Fixture API error'},
        responseText: 'Fixture API error',
        getResponseHeader: () => null,
      };
      return Promise.reject(
        new RequestError(method, path, new Error('Fixture API error'), response)
      );
    }

    return Promise.resolve(handleFixtureRequest(state, basePath, path, options));
  };
}

type FixtureState = {
  allocatedBlockIds: Set<string>;
  allocatedInvestigationIds: Set<string>;
  details: Map<string, InvestigationDetail>;
  executions: Map<string, InvestigationExecutionDetail>;
  list: InvestigationListItem[];
  titleGenerations: Map<string, InvestigationTitleGeneration>;
  pageLinks?: string;
};

function createFixtureState(config: FixtureApiConfig): FixtureState {
  const details = new Map(
    (config.details ?? []).map(detail => [detail.id, cloneFixture(detail)])
  );
  const list = cloneFixture(
    config.list?.length ? config.list : Array.from(details.values())
  );

  return {
    allocatedBlockIds: new Set(
      Array.from(details.values()).flatMap(detail =>
        (detail.blocks ?? []).map(block => block.id)
      )
    ),
    allocatedInvestigationIds: new Set([
      ...details.keys(),
      ...list.map(investigation => investigation.id),
    ]),
    details,
    list,
    pageLinks: config.pageLinks,
    executions: new Map(
      Object.entries(config.executions ?? {}).map(([key, execution]) => [
        key,
        cloneFixture(execution),
      ])
    ),
    titleGenerations: new Map(
      Object.entries(config.titleGenerations ?? {}).map(([key, generation]) => [
        key,
        cloneFixture(generation),
      ])
    ),
  };
}

function handleFixtureRequest(
  state: FixtureState,
  basePath: string,
  path: string,
  options: Readonly<RequestOptions>
): FixtureResponse {
  const method = normalizeMethod(options.method);
  const parts = path.slice(basePath.length).split('/').filter(Boolean);
  const data = (options.data ?? {}) as Record<string, unknown>;

  if (parts.length === 0) {
    if (method === 'GET') {
      const query = String(options.query?.query ?? '')
        .trim()
        .toLocaleLowerCase();
      const visibleList = query
        ? state.list.filter(investigation =>
            investigation.title.toLocaleLowerCase().includes(query)
          )
        : state.list;
      return {
        body: cloneFixture(visibleList),
        headers: state.pageLinks ? {Link: state.pageLinks} : undefined,
      };
    }
    if (method === 'POST') {
      const id = reserveFixtureId(
        `investigation-story-${state.list.length + 1}`,
        state.allocatedInvestigationIds
      );
      const templateKey = getDataString(data, 'templateKey');
      const detail = InvestigationDetailFixture({
        id,
        title: getDataString(data, 'title') ?? 'Untitled investigation',
        sourceType: templateKey ? 'metric_open_period' : 'manual',
        template: templateKey
          ? {key: templateKey, version: getDataNumber(data, 'templateVersion') ?? 1}
          : null,
        blocks: [],
      });
      state.details.set(id, detail);
      state.list.push(detail);
      return {body: cloneFixture(detail)};
    }
  }

  const investigationId = parts[0];
  if (!investigationId) {
    throw new Error(`Invalid fixture investigation path: ${path}`);
  }

  if (parts.length === 1) {
    if (method === 'GET') {
      return {body: cloneFixture(getFixtureDetail(state, investigationId))};
    }
    if (method === 'PUT') {
      const detail = getFixtureDetail(state, investigationId);
      const updated = {
        ...detail,
        title: getDataString(data, 'title') ?? detail.title,
        version: detail.version + 1,
        dateUpdated: '2026-08-27T15:45:00Z',
      };
      setFixtureDetail(state, updated);
      return {body: cloneFixture(updated)};
    }
    if (method === 'DELETE') {
      state.details.delete(investigationId);
      state.list = state.list.filter(item => item.id !== investigationId);
      return {body: undefined};
    }
  }

  if (parts[1] === 'favorite' && method === 'PUT') {
    const detail = getFixtureDetail(state, investigationId);
    setFixtureDetail(state, {
      ...detail,
      isFavorited: data.shouldFavorite === true,
    });
    return {body: undefined};
  }

  if (parts[1] === 'duplicate' && method === 'POST') {
    const detail = getFixtureDetail(state, investigationId);
    const duplicate = {
      ...cloneFixture(detail),
      id: reserveFixtureId(`${detail.id}-copy`, state.allocatedInvestigationIds),
      title: `${detail.title} copy`,
      dateCreated: '2026-08-27T15:45:00Z',
      dateUpdated: '2026-08-27T15:45:00Z',
      isFavorited: false,
      version: 1,
    };
    setFixtureDetail(state, duplicate);
    return {body: cloneFixture(duplicate)};
  }

  if (parts[1] === 'title-generation' && method === 'GET') {
    const detail = getFixtureDetail(state, investigationId);
    return {
      body: cloneFixture(
        state.titleGenerations.get(investigationId) ?? {
          status: detail.titleGeneration?.status ?? null,
          preview: null,
        }
      ),
    };
  }

  if (parts[1] === 'blocks' && parts.length === 2 && method === 'POST') {
    const detail = getFixtureDetail(state, investigationId);
    const kind = data.kind === 'query' ? 'query' : 'text';
    const blocks = detail.blocks ?? [];
    const block = InvestigationBlockFixture({
      id: reserveFixtureId(
        `storybook-${kind}-${blocks.length + 1}`,
        state.allocatedBlockIds
      ),
      position: Math.max(-1, ...blocks.map(existingBlock => existingBlock.position)) + 1,
      kind,
      title: getDataString(data, 'title') ?? '',
      content: '',
      generationPrompt: getDataString(data, 'generationPrompt') ?? '',
      display: {type: kind === 'query' ? 'table' : 'markdown'},
    });
    setFixtureDetail(state, {
      ...detail,
      blocks: [...blocks, block],
      blockCount: detail.blockCount + 1,
      version: detail.version + 1,
    });
    return {body: cloneFixture(block)};
  }

  const blockId = parts[2];
  if (parts[1] === 'blocks' && blockId && parts.length === 3) {
    const detail = getFixtureDetail(state, investigationId);
    const block = detail.blocks?.find(candidate => candidate.id === blockId);
    if (!block) {
      throw new Error(`Unknown fixture investigation block: ${blockId}`);
    }

    if (method === 'PUT') {
      const updatedBlock = {
        ...block,
        generationPrompt:
          getDataString(data, 'generationPrompt') ?? block.generationPrompt,
        version: block.version + 1,
      };
      setFixtureDetail(state, {
        ...detail,
        blocks: detail.blocks?.map(candidate =>
          candidate.id === blockId ? updatedBlock : candidate
        ),
        version: detail.version + 1,
      });
      return {body: cloneFixture(updatedBlock)};
    }

    if (method === 'DELETE') {
      setFixtureDetail(state, {
        ...detail,
        blocks: detail.blocks?.filter(candidate => candidate.id !== blockId),
        blockCount: Math.max(0, detail.blockCount - 1),
        version: detail.version + 1,
      });
      return {body: undefined};
    }
  }

  if (
    parts[1] === 'blocks' &&
    blockId &&
    parts[3] === 'executions' &&
    parts.length === 4 &&
    method === 'POST'
  ) {
    const detail = getFixtureDetail(state, investigationId);
    const executionId = `${blockId}-storybook-run`;
    const execution = InvestigationExecutionDetailFixture({
      id: executionId,
      status: 'completed',
      blocks: [
        InvestigationTranscriptBlockFixture({
          id: `${executionId}-request`,
          message: {
            role: 'user',
            content: 'Compare the regression with the most recent deploy.',
          },
        }),
        InvestigationTranscriptBlockFixture({
          id: `${executionId}-answer`,
          timestamp: '2026-08-17T10:00:06Z',
          message: {
            role: 'assistant',
            content:
              'The regression starts four minutes after the deploy and affects every checkout region.',
          },
        }),
      ],
    });
    state.executions.set(
      investigationExecutionFixtureKey(blockId, executionId),
      execution
    );
    setFixtureDetail(state, {
      ...detail,
      blocks: detail.blocks?.map(block =>
        block.id === blockId
          ? {
              ...block,
              output:
                block.kind === 'query'
                  ? InvestigationQueryOutputFixture({
                      tableMarkdown:
                        '| Transaction | p95 before | p95 after |\n| --- | ---: | ---: |\n| `POST /api/checkout` | 421ms | 1.84s |',
                    })
                  : {
                      schemaVersion: 1,
                      markdown:
                        'The regression begins four minutes after the deploy and is concentrated in database connection acquisition.',
                    },
              outputStatus: 'completed',
              currentExecution: InvestigationBlockExecutionFixture({id: executionId}),
            }
          : block
      ),
    });
    return {body: {id: executionId, status: 'completed'}};
  }

  const executionId = parts[4];
  if (
    parts[1] === 'blocks' &&
    blockId &&
    parts[3] === 'executions' &&
    executionId &&
    parts.length === 5
  ) {
    const key = investigationExecutionFixtureKey(blockId, executionId);
    if (method === 'GET') {
      return {
        body: cloneFixture(
          state.executions.get(key) ??
            InvestigationExecutionDetailFixture({id: executionId})
        ),
      };
    }

    if (method === 'DELETE' || method === 'PATCH') {
      const detail = getFixtureDetail(state, investigationId);
      const status = method === 'DELETE' ? 'cancelled' : 'completed';
      const current =
        state.executions.get(key) ??
        InvestigationExecutionDetailFixture({id: executionId});
      state.executions.set(key, {
        ...current,
        status,
        pendingUserInput: null,
      });
      setFixtureDetail(state, {
        ...detail,
        blocks: detail.blocks?.map(block =>
          block.id === blockId
            ? {
                ...block,
                outputStatus: status,
                currentExecution: InvestigationBlockExecutionFixture({
                  id: executionId,
                  status,
                  error:
                    status === 'cancelled' ? {message: 'Stopped by the user.'} : null,
                }),
              }
            : block
        ),
      });
      return {body: undefined};
    }
  }

  throw new Error(`Unhandled fixture API request: ${method} ${path}`);
}

function getFixtureDetail(state: FixtureState, investigationId: string) {
  const detail = state.details.get(investigationId);
  if (detail) {
    return detail;
  }

  const listItem = state.list.find(item => item.id === investigationId);
  if (!listItem) {
    throw new Error(`Unknown fixture investigation: ${investigationId}`);
  }
  const generatedDetail = InvestigationDetailFixture({...listItem, blocks: []});
  state.details.set(investigationId, generatedDetail);
  return generatedDetail;
}

function setFixtureDetail(state: FixtureState, detail: InvestigationDetail) {
  state.details.set(detail.id, detail);
  const listIndex = state.list.findIndex(item => item.id === detail.id);
  if (listIndex === -1) {
    state.list.push(detail);
    return;
  }
  state.list[listIndex] = {...state.list[listIndex], ...detail};
}

function normalizeMethod(method: RequestOptions['method']) {
  return method ?? 'GET';
}

function getDataString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

function getDataNumber(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'number' ? value : undefined;
}

function reserveFixtureId(preferredId: string, allocatedIds: Set<string>) {
  let id = preferredId;
  let suffix = 2;
  while (allocatedIds.has(id)) {
    id = `${preferredId}-${suffix}`;
    suffix += 1;
  }
  allocatedIds.add(id);
  return id;
}

function cloneFixture<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}
