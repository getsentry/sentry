import type {AutofixSetupResponse} from 'sentry/components/events/autofix/useAutofixSetup';

export function AutofixSetupFixture(
  params: Partial<AutofixSetupResponse>
): AutofixSetupResponse {
  return {
    autofixEnabled: true,
    integration: {
      ok: true,
      reason: null,
    },
    seerReposLinked: true,
    setupAcknowledgement: {
      orgHasAcknowledged: true,
      userHasAcknowledged: true,
    },
    githubWriteIntegration: {
      ok: true,
      repos: [],
    },
    billing: {
      hasAutofixQuota: true,
    },
    ...params,
  };
}
