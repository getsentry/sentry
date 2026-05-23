import type {QueryFunctionContext} from '@tanstack/react-query';
import * as qs from 'query-string';

import type {ResponseMeta} from 'sentry/api';
import {isSimilarOrigin, resolveHostname} from 'sentry/api';
import {
  PROJECT_MOVED,
  SUDO_REQUIRED,
  SUPERUSER_REQUIRED,
} from 'sentry/constants/apiErrorCodes';
import type {
  ApiQueryKey,
  InfiniteApiQueryKey,
  QueryKeyEndpointOptions,
} from 'sentry/utils/api/apiQueryKey';
import {getCsrfToken} from 'sentry/utils/getCsrfToken';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {RequestError} from 'sentry/utils/requestError/requestError';

export type ApiResponse<TResponseData = unknown> = {
  headers: {
    Link?: string;
    'X-Hits'?: number;
    'X-Max-Hits'?: number;
  };
  json: TResponseData;
};

export interface SentryCellFetchErrorHandlers {
  /**
   * Called on 401 responses. Return true to suppress the error (e.g., after
   * handling via redirect). Called BEFORE the generic onError handler.
   */
  onAuthError?: (
    response: ResponseMeta,
    requestOptions: QueryKeyEndpointOptions
  ) => boolean;

  /**
   * Generic catch-all error handler. Called for ALL error responses not already
   * suppressed by a named handler. Return true to suppress, false to throw.
   */
  onError?: (response: ResponseMeta, requestOptions: QueryKeyEndpointOptions) => boolean;

  /**
   * Called when response has PROJECT_MOVED code. Return true to suppress the
   * error and handle the redirect externally.
   */
  onProjectRenamed?: (response: ResponseMeta) => boolean;

  /**
   * Called on 403 with SUDO_REQUIRED or SUPERUSER_REQUIRED code. Receives a
   * retry function that re-issues the same request. Should return a promise
   * that resolves with the retry result, or rejects on failure.
   */
  onSudoRequired?: (
    response: ResponseMeta,
    retry: () => Promise<ApiResponse>
  ) => Promise<ApiResponse>;
}

export interface SentryCellFetchConfig {
  baseUrl?: string;
  credentials?: RequestCredentials;
  errorHandlers?: SentryCellFetchErrorHandlers;
  headers?: Record<string, string>;
}

const JSON_HEADERS: Record<string, string> = {
  Accept: 'application/json; charset=utf-8',
  'Content-Type': 'application/json',
};

let currentConfig: SentryCellFetchConfig = {};

export function configureSentryCellFetch(newConfig: SentryCellFetchConfig): void {
  currentConfig = newConfig;
}

function csrfSafeMethod(method: string): boolean {
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method);
}

function buildUrl(
  path: string,
  query: Record<string, unknown> | undefined,
  host: string | undefined
): string {
  const baseUrl = currentConfig.baseUrl ?? '/api/0';
  let fullUrl = path.includes(baseUrl) ? path : baseUrl + path;

  fullUrl = resolveHostname(fullUrl, host);

  if (query) {
    const params = qs.stringify(query);
    if (params) {
      fullUrl += fullUrl.includes('?') ? `&${params}` : `?${params}`;
    }
  }

  return fullUrl;
}

function buildResponseHeaders(response: Response): ApiResponse['headers'] {
  const hits = response.headers.get('X-Hits');
  const maxHits = response.headers.get('X-Max-Hits');
  return {
    Link: response.headers.get('Link') ?? undefined,
    'X-Hits': typeof hits === 'string' ? Number(hits) : undefined,
    'X-Max-Hits': typeof maxHits === 'string' ? Number(maxHits) : undefined,
  };
}

async function executeFetch(
  fullUrl: string,
  options: QueryKeyEndpointOptions,
  signal?: AbortSignal
): Promise<ApiResponse> {
  const method = options.method ?? 'GET';

  let body: BodyInit | undefined;
  if (options.data !== undefined && method !== 'GET') {
    body = JSON.stringify(options.data);
  }

  const baseHeaders = currentConfig.headers ?? JSON_HEADERS;
  const requestHeaders = new Headers({...baseHeaders, ...options.headers});

  if (!csrfSafeMethod(method) && isSimilarOrigin(fullUrl, window.location.origin)) {
    requestHeaders.set('X-CSRFToken', getCsrfToken());
  }

  const response = await fetch(fullUrl, {
    method,
    body,
    headers: requestHeaders,
    credentials: currentConfig.credentials ?? 'include',
    signal,
  });

  // Parse response body
  let responseJSON: any;
  let responseText = '';
  let {ok} = response;
  const {status, statusText} = response;

  try {
    responseText = await response.text();
  } catch {
    ok = false;
  }

  const responseContentType = response.headers.get('content-type');
  const isResponseJSON = responseContentType?.includes('json');
  const isStatus3XX = status >= 300 && status < 400;

  if (status !== 204 && !isStatus3XX) {
    try {
      responseJSON = JSON.parse(responseText);
    } catch (error: unknown) {
      if (isResponseJSON && error instanceof SyntaxError) {
        ok = false;
      } else if (
        responseText.length > 0 &&
        requestHeaders.get('Accept') === JSON_HEADERS.Accept &&
        error instanceof SyntaxError
      ) {
        ok = false;
      }
    }
  }

  const responseMeta: ResponseMeta = {
    status,
    statusText,
    responseJSON,
    responseText,
    getResponseHeader: (header: string) => response.headers.get(header),
  };

  if (!ok) {
    return handleErrorResponse(responseMeta, options, response, fullUrl);
  }

  const responseData = isResponseJSON ? responseJSON : responseText;
  return {
    headers: buildResponseHeaders(response),
    json: responseData,
  };
}

async function handleErrorResponse(
  responseMeta: ResponseMeta,
  options: QueryKeyEndpointOptions,
  response: Response,
  fullUrl: string
): Promise<ApiResponse> {
  const errorHandlers = currentConfig.errorHandlers;
  const code = responseMeta.responseJSON?.detail?.code;
  const method = options.method ?? 'GET';

  // 1. Sudo/superuser — handler owns the retry and promise resolution
  if (
    (code === SUDO_REQUIRED || code === SUPERUSER_REQUIRED) &&
    errorHandlers?.onSudoRequired
  ) {
    return errorHandlers.onSudoRequired(responseMeta, () =>
      executeFetch(fullUrl, options, undefined)
    );
  }

  // 2. Project renamed — handler does the redirect
  if (code === PROJECT_MOVED && errorHandlers?.onProjectRenamed?.(responseMeta)) {
    return {headers: buildResponseHeaders(response), json: undefined as unknown};
  }

  // 3. Auth error (401) — handler does the redirect
  if (
    responseMeta.status === 401 &&
    errorHandlers?.onAuthError?.(responseMeta, options)
  ) {
    return {headers: buildResponseHeaders(response), json: undefined as unknown};
  }

  // 4. Generic catch-all
  if (errorHandlers?.onError?.(responseMeta, options)) {
    return {headers: buildResponseHeaders(response), json: undefined as unknown};
  }

  // 5. Nothing handled it — throw
  const error = new RequestError(
    method,
    fullUrl,
    new Error('Request failed'),
    responseMeta
  );
  throw error;
}

export async function sentryCellFetch<TQueryFnData = unknown>(
  context: QueryFunctionContext<ApiQueryKey>
): Promise<ApiResponse<TQueryFnData>> {
  const [url, options] = context.queryKey;

  const fullUrl = buildUrl(url, options?.query, options?.host);

  const result = await executeFetch(
    fullUrl,
    {
      allowAuthError: options?.allowAuthError,
      host: options?.host,
      method: options?.method ?? 'GET',
      data: options?.data,
      headers: options?.headers,
    },
    context.signal
  );

  return result as ApiResponse<TQueryFnData>;
}

export async function sentryCellFetchInfinite<TQueryFnData = unknown>(
  context: QueryFunctionContext<InfiniteApiQueryKey, null | undefined | ParsedHeader>
): Promise<ApiResponse<TQueryFnData>> {
  const [url, options] = context.queryKey;

  const query = {
    ...options?.query,
    cursor: context.pageParam?.cursor ?? options?.query?.cursor,
  };

  const fullUrl = buildUrl(url, query, options?.host);

  const result = await executeFetch(
    fullUrl,
    {
      allowAuthError: options?.allowAuthError,
      host: options?.host,
      method: options?.method ?? 'GET',
      data: options?.data,
      headers: options?.headers,
    },
    context.signal
  );

  return result as ApiResponse<TQueryFnData>;
}
