/** Expose the pinned Fetch client's own preparation without dispatching a request. */
import { replaceOnce, update } from "../lib/generated-source.mjs";

export function emit() {
  update("client/client.gen.ts", source => {
    source = replaceOnce(source,
      "export const createClient = (config: Config = {}): Client => {",
      `/** The concrete SDK transport adds preparation without requiring it from custom Clients. */
export type PreparedClient = Client & {
  /** Prepare a native Request using configured auth, serializers and request interceptors, without calling fetch. */
  prepareRequest(options: RequestOptions & Pick<Required<RequestOptions>, 'method'>): Promise<Request>;
};

export const createClient = (config: Config = {}): PreparedClient => {`);
    source = replaceOnce(source,
      "  // The public Client signature applies operation-specific data and throw types.\n  const request = async (options: RequestOptions) => {",
      "  const prepare = async (options: RequestOptions) => {");
    source = replaceOnce(source,
      "    // fetch must be assigned here, otherwise it would throw the error:",
      `    return { request, opts };
  };

  const prepareRequest = async (options: RequestOptions): Promise<Request> =>
    (await prepare(options)).request;

  // The public Client signature applies operation-specific data and throw types.
  const request = async (options: RequestOptions) => {
    const { request, opts } = await prepare(options);

    // fetch must be assigned here, otherwise it would throw the error:`);
    source = replaceOnce(source, "    request,\n    setConfig,", "    request,\n    prepareRequest,\n    setConfig,");
    return replaceOnce(source, "  } as Client;", "  } as PreparedClient;");
  });

  update("client/index.ts", source => replaceOnce(source,
    "export { createClient } from './client.gen';",
    "export { createClient } from './client.gen';\nexport type { PreparedClient } from './client.gen';",
  ));

  // Raw endpoints can already contain a query. Overlay explicitly serialized keys
  // without re-encoding unrelated values or a custom serializer's output.
  update("core/utils.gen.ts", source => replaceOnce(source,
    `  if (search) {
    url += \`?\${search}\`;
  }
  return url;`,
    `  url = url.split('#', 1)[0]!;
  const queryIndex = url.indexOf('?');
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const existing = queryIndex === -1 ? '' : url.slice(queryIndex + 1);
  const replaced = new Set(new URLSearchParams('?' + search).keys());
  // An explicit null clears an existing parameter; undefined leaves it alone.
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null) replaced.add(key);
  }
  const retained = existing.split('&').filter(part => {
    const key = new URLSearchParams('?' + part).keys().next().value;
    return part !== '' && (key === undefined || !replaced.has(key));
  });
  const combined = [...retained, search].filter(Boolean).join('&');
  return pathname + (combined ? \`?\${combined}\` : '');`,
  ));
}
