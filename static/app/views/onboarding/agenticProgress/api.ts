import {skipToken} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';

import type {AgenticProgressRun} from './types';

export const agenticProgressRunOptions = ({
  organizationSlug,
  runId,
}: {
  organizationSlug: string;
  runId: string | null;
}) =>
  apiOptions.as<AgenticProgressRun>()(
    '/organizations/$organizationIdOrSlug/onboarding/agent/runs/$runId/',
    {
      path: runId ? {organizationIdOrSlug: organizationSlug, runId} : skipToken,
      staleTime: 0,
    }
  );
