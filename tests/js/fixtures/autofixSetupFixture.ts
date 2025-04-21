import { AutofixSetupResponse } from "sentry/components/events/autofix/useAutofixSetup";

export function AutofixSetupFixture(params: Partial<AutofixSetupResponse>): AutofixSetupResponse {
  return {
    genAIConsent: {
      ok: true,
    },
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
    ...params,
  }
}
