import { Secret } from "sentry/views/settings/featureFlags";


export function SecretFixture(
  params: Partial<Secret> = {}
): Secret {
  return {
    id: 1,
    provider: 'launchdarkly',
    secret: '123abc**************************',
    createdAt: "2024-12-12T00:00:00+00:00",
    createdBy: 1234,
    ...params,
  };
}
