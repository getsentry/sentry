import {useAgenticProgress} from './useAgenticProgress';
import {
  useAgenticProgressInit,
  type UseAgenticProgressInitOptions,
} from './useAgenticProgressInit';

export function useAgenticSetupRun(options: UseAgenticProgressInitOptions) {
  const {
    query: initialization,
    onboardingCode,
    restartRun,
  } = useAgenticProgressInit(options);
  const progress = useAgenticProgress({
    runId: initialization.data?.runId ?? null,
    enabled: options.enabled,
  });
  const run = progress.data ?? initialization.data;
  const connectionStatus = run?.stages.find(
    stage => stage.stage === 'connect_mcp'
  )?.status;

  return {
    run,
    onboardingCode,
    isAgentConnected:
      connectionStatus !== null &&
      connectionStatus !== undefined &&
      connectionStatus !== 'failed',
    isSetupComplete: run?.runStatus === 'completed',
    hasRunFailed: run?.runStatus === 'failed' || run?.runStatus === 'cancelled',
    hasInitFailed: initialization.isError,
    hasProgressFailed: progress.isError,
    refreshRun: progress.refetch,
    restartRun,
  };
}
