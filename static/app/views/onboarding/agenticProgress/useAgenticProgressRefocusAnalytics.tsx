import {useEffect, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {AgenticProgressRun} from './types';

type AgenticProgressStage = AgenticProgressRun['stages'][number];

function getCurrentStage(stages: AgenticProgressStage[]) {
  return (
    stages.find(stage => ['active', 'waiting', 'failed'].includes(stage.status ?? '')) ??
    stages.findLast(stage => stage.status !== null) ??
    stages[0]
  );
}

export function useAgenticProgressRefocusAnalytics(run: AgenticProgressRun | undefined) {
  const organization = useOrganization();
  const blurredAtRef = useRef<number | null>(null);
  const currentStage = run ? getCurrentStage(run.stages) : undefined;
  const runId = run?.runId;
  const runStatus = run?.runStatus;

  useEffect(() => {
    function handleBlur() {
      blurredAtRef.current = Date.now();
    }

    function handleFocus() {
      const blurredAt = blurredAtRef.current;
      if (blurredAt === null || !runId || !runStatus) {
        return;
      }

      blurredAtRef.current = null;
      trackAnalytics('onboarding.agentic_progress_refocused', {
        organization,
        duration_seconds: (Date.now() - blurredAt) / 1_000,
        run_id: runId,
        run_status: runStatus,
        stage: currentStage?.stage ?? null,
        stage_status: currentStage?.status ?? null,
      });
    }

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentStage?.stage, currentStage?.status, organization, runId, runStatus]);
}
