/**
 * Adapt the pinned Fetch generator to the public SDK's fields/error contract.
 * Each replacement fails closed so generator upgrades cannot silently discard it.
 */
import { replaceOnce, update } from "../lib/generated-source.mjs";

export function emit() {
  update("client/client.gen.ts", source => {
    source = replaceOnce(source, "import { createSseClient }", "import { SentryApiError } from '../sentry-errors';\n\nimport { createSseClient }");
    source = replaceOnce(source, "export const createClient = (config: Config = {}): Client => {", `// Reject unsupported configuration instead of changing its meaning at runtime.
const assertFields = (config: { responseStyle?: unknown }): void => {
  if (config.responseStyle !== undefined && config.responseStyle !== 'fields') {
    throw new TypeError('@sentry/api only supports responseStyle: "fields". Read result.data instead.');
  }
};

export const createClient = (config: Config = {}): Client => {
  assertFields(config);`);
    source = replaceOnce(source, "  const setConfig = (config: Config): Config => {", "  const setConfig = (config: Config): Config => {\n    assertFields(config);");
    source = replaceOnce(source, "TResponseStyle extends 'data' | 'fields' = 'fields'", "TResponseStyle extends 'fields' = 'fields'");
    source = replaceOnce(source, "    options: RequestOptions<TData, TResponseStyle, ThrowOnError, Url>,\n  ) => {", "    options: RequestOptions<TData, TResponseStyle, ThrowOnError, Url>,\n  ) => {\n    assertFields(options);");

    // 0.97 catches preparation, interceptors and decoding as well as fetch. Keep
    // our existing contract: only dispatch failures enter the network-error path.
    const requestPattern = /  const request: Client\['request'\] = async \(options\) => \{[\s\S]*?\n  \};/;
    const request = source.match(requestPattern)?.[0];
    const body = request?.match(/    try \{\n([\s\S]*?)\n    \} catch \(error\) \{/)?.[1];
    if (!body) throw new Error("Fetch generator changed: request try/catch not found");
    source = replaceOnce(source, requestPattern,
      "  // The public Client signature applies operation-specific data and throw types.\n  const request = async (options: RequestOptions) => {\n"
      + body.replace(/^  /gm, "") + "\n  };");
    source = replaceOnce(source, "    request = new Request(url, requestInit);", "    let request = new Request(url, requestInit);");
    source = replaceOnce(source, "    response = await _fetch(request);", `    let response: Response;
    try {
      // Check the final intercepted Request, preserving the fetch-error contract.
      request.signal.throwIfAborted();
      response = await _fetch(request);
    } catch (error) {
      let finalError: unknown = error;
      for (const fn of interceptors.error.fns) {
        if (fn) finalError = await fn(finalError, undefined, request, opts);
      }
      if (opts.throwOnError) throw finalError;
      return { error: finalError, request, response: undefined };
    }`);
    source = replaceOnce(source, `        return opts.responseStyle === 'data'
          ? emptyData
          : {
              data: emptyData,
              ...result,
            };`, `        return { data: emptyData, ...result };`);
    source = replaceOnce(source, `          return opts.responseStyle === 'data'
            ? response.body
            : {
                data: response.body,
                ...result,
              };`, `          return { data: response.body, ...result };`);
    source = replaceOnce(source, `      return opts.responseStyle === 'data'
        ? data
        : {
            data,
            ...result,
          };`, `      return { data, ...result };`);
    source = replaceOnce(source, `    let jsonError: unknown;

    try {
      jsonError = JSON.parse(textError);
    } catch {
      // noop
    }

    throw jsonError ?? textError;`, `    let body: unknown = textError;
    try {
      body = JSON.parse(textError);
    } catch {
      // Non-JSON HTTP error bodies remain available as text.
    }

    // Normalize once, before user interceptors. A custom mapping owns its result.
    let finalError: unknown = new SentryApiError(
      response.status, body, response, false, undefined,
      { request, rawBody: textError },
    );
    for (const fn of interceptors.error.fns) {
      if (fn) finalError = await fn(finalError, response, request, opts);
    }
    if (opts.throwOnError) throw finalError;
    return { error: finalError, ...result };`);
    return source;
  });

  update("client/types.gen.ts", source => {
    source = replaceOnce(source, "import type { Auth }", "import type { SdkResult } from '../sentry-errors';\n\nimport type { Auth }");
    source = replaceOnce(source, "export type ResponseStyle = 'data' | 'fields';", "export type ResponseStyle = 'fields';");
    source = replaceOnce(source, "Should we return only data or multiple fields (data, error, response, etc.)?", "Responses always include fields (data or error, request, response).");
    // The stream and its onSseEvent callback must share the caller's data type.
    source = replaceOnce(source,
      "options: Omit<RequestOptions<never, TResponseStyle, ThrowOnError>, 'method'>,",
      "options: Omit<RequestOptions<TData, TResponseStyle, ThrowOnError>, 'method'>,",
    );
    return replaceOnce(source, /export type RequestResult<[\s\S]*?(?=\nexport interface ClientOptions)/, `export type RequestResult<
  TData = unknown,
  TError = unknown,
  ThrowOnError extends boolean = boolean,
  TResponseStyle extends ResponseStyle = 'fields',
> = Promise<ThrowOnError extends true
  ? {
      data: TData extends Record<string, unknown> ? TData[keyof TData] : TData;
      request: Request;
      response: Response;
    }
  : SdkResult<TData extends Record<string, unknown> ? TData[keyof TData] : TData>>;
`);
  });

  update("client/utils.gen.ts", source => replaceOnce(source,
    "  /** request may be undefined, because error may be from building the request object itself */\n  request: Req | undefined,",
    "  request: Req,",
  ));
}
