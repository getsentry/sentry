const CACHE_NAME = 'v1_client-config';
const CACHE_KEY = '/api/client-config/';

// A subset of the Config interface. (see: sentry/static/app/types/system.tsx)
export interface ClientConfig {
  apmSampling: number;
  customerDomain: {
    organizationUrl: string | undefined;
    sentryUrl: string;
    subdomain: string;
  } | null;
  dsn: string;
  features: string[];
  links: {
    organizationUrl: string;
    regionUrl: string;
    sentryUrl: string;
  };
  sentryConfig: {
    allowUrls: string[];
    dsn: string;
    release: string;
    tracePropagationTargets: string[];
    environment?: string;
    profileSessionSampleRate?: number;
  };
  userIdentity: {
    email: string;
    id: string;
    ip_address: string;
    isStaff: boolean;
  };
}

// A read-through cache for the client config.
// We'll kick off a network request to fetch the config
// and we'll either return the cached (old) value if it exists, or return the
// fresh response from the network.
export async function fetchClientConfig(): Promise<ClientConfig> {
  const cache = await caches.open(CACHE_NAME);

  const fetchAndCachePromise: Promise<ClientConfig> = fetch('/api/client-config/', {
    credentials: 'include',
    headers: {'Content-Type': 'application/json'},
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return cache.put(CACHE_KEY, response.clone()).then(() => response.json());
    })
    .catch(() => {
      /* Nothing we can do, without this Sentry.init can't be called */
    });

  const cachedResponse = await cache.match(CACHE_KEY);
  if (cachedResponse) {
    fetchAndCachePromise.catch(() => {
      /* Nothing we can do, without this Sentry.init can't be called */
    });
    return cachedResponse.json();
  }

  return fetchAndCachePromise;
}

export async function getClientConfigFromCache(): Promise<ClientConfig> {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(CACHE_KEY).then(response => response?.json());
}
