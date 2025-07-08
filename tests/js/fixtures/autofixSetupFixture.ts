import type {AutofixSetupResponse} from 'sentry/components/events/autofix/useAutofixSetup';

export function AutofixSetupFixture(
  params: Partial<AutofixSetupResponse>
): AutofixSetupResponse {
  return {
    integration: {
      ok: true,
      reason: null,
    },
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
