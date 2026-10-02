import type {AgenticProgressRun} from 'sentry/views/onboarding/agenticProgress/types';

export function AgenticProgressRunFixture(
  params: Partial<AgenticProgressRun> = {}
): AgenticProgressRun {
  return {
    channelId: '54c300212517432d91c915960bfc5c09',
    clientRunId: '021902d5-2333-4823-81a9-5596b331e8af',
    continueUpdates: true,
    createdAt: '2026-08-13T14:01:28.298407Z',
    expiresAt: '2026-08-14T14:01:28.298407Z',
    runId: '16ff4fe7966f495ab788069fb35d8e7b',
    runStatus: 'active',
    schemaVersion: 1,
    sequence: 0,
    stages: [
      {
        eventNote: null,
        extra: null,
        stage: 'connect_mcp',
        status: null,
      },
    ],
    updatedAt: '2026-08-13T14:01:28.298407Z',
    onboardingCode: 'Lg1iSt2qeQ',
    ...params,
  };
}
