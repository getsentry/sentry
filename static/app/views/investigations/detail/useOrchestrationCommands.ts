import {useCallback, useEffect, useMemo, useState} from 'react';
import {uuid4} from '@sentry/core';
import {useQueryClient} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {
  investigationOrchestrationQueryOptions,
  isInvestigationOrchestrationConflictError,
  useInvestigationOrchestrationCommandMutation,
} from 'sentry/views/investigations/api';
import type {
  InvestigationHypothesis,
  InvestigationOrchestration,
  InvestigationOrchestrationCommand,
} from 'sentry/views/investigations/types';

const COMMAND_STALE_AFTER_MS = 2 * 60 * 1000;

export type OrchestrationCommandTarget =
  | 'add-hypothesis'
  | 'cancel'
  | 'input'
  | 'report'
  | 'report-action'
  | 'run'
  | 'workflow'
  | `block:${string}`
  | `hypothesis:${string}`
  | `hypothesis-decision:${string}`;

type PendingCommand = {
  baseline: InvestigationOrchestration;
  command: InvestigationOrchestrationCommand;
  requestId: string;
  submittedAt: number;
  target: OrchestrationCommandTarget;
  transportRetryCount: number;
  acknowledged?: boolean;
};

type CommandProjectionError = {
  message: string;
  retryTransport: boolean;
};

export type OrchestrationCommandState = {
  error: string | null;
  errorTarget: OrchestrationCommandTarget | null;
  isPending: boolean;
  pendingTarget: OrchestrationCommandTarget | null;
};

export function useOrchestrationCommands({
  investigationId,
  orchestration,
  organizationSlug,
}: {
  investigationId: string;
  orchestration: InvestigationOrchestration | undefined;
  organizationSlug: string;
}) {
  const mutation = useInvestigationOrchestrationCommandMutation(
    organizationSlug,
    investigationId
  );
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [error, setError] = useState<{
    message: string;
    target: OrchestrationCommandTarget;
  } | null>(null);
  const mutateCommand = mutation.mutate;

  const dispatchCommand = useCallback(
    (commandToDispatch: PendingCommand) => {
      mutateCommand(
        {
          command: commandToDispatch.command,
          expectedWorkflowVersion: commandToDispatch.baseline.workflowVersion,
          requestId: commandToDispatch.requestId,
        },
        {
          onSuccess: () => {
            setPending(current =>
              current?.requestId === commandToDispatch.requestId
                ? {...current, acknowledged: true}
                : current
            );
          },
          onError: mutationError => {
            setPending(current =>
              current?.requestId === commandToDispatch.requestId ? null : current
            );
            setError({
              message: isInvestigationOrchestrationConflictError(mutationError)
                ? t(
                    'The investigation changed before this update was applied. Progress was refreshed; try again.'
                  )
                : getRequestErrorUserMessage(
                    mutationError,
                    t('Unable to update the investigation. Please try again.')
                  ),
              target: commandToDispatch.target,
            });
          },
        }
      );
    },
    [mutateCommand]
  );

  const displayedOrchestration = useMemo(
    () =>
      orchestration && pending
        ? applyOptimisticOrchestrationCommand(
            orchestration,
            pending.command,
            pending.requestId
          )
        : orchestration,
    [orchestration, pending]
  );

  useEffect(() => {
    if (!pending?.acknowledged || !orchestration) {
      return;
    }
    if (isOrchestrationCommandReflected(orchestration, pending)) {
      setPending(null);
      return;
    }
    const commandError = getNewCommandError(orchestration, pending);
    if (commandError) {
      if (commandError.retryTransport && pending.transportRetryCount < 1) {
        const retry = {
          ...pending,
          acknowledged: false,
          submittedAt: Date.now(),
          transportRetryCount: pending.transportRetryCount + 1,
        };
        setPending(retry);
        dispatchCommand(retry);
        return;
      }
      setPending(null);
      setError({message: commandError.message, target: pending.target});
    }
  }, [dispatchCommand, orchestration, pending]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const timeout = window.setTimeout(
      () => {
        setPending(current =>
          current?.requestId === pending.requestId ? null : current
        );
        setError({
          message: t(
            'Seer did not acknowledge this update in time. Progress was refreshed; try again.'
          ),
          target: pending.target,
        });
        void queryClient.invalidateQueries({
          queryKey: investigationOrchestrationQueryOptions(
            organizationSlug,
            investigationId
          ).queryKey,
        });
      },
      Math.max(pending.submittedAt + COMMAND_STALE_AFTER_MS - Date.now(), 0)
    );
    return () => window.clearTimeout(timeout);
  }, [investigationId, organizationSlug, pending, queryClient]);

  useEffect(() => {
    if (!pending?.acknowledged) {
      return;
    }
    const orchestrationKey = investigationOrchestrationQueryOptions(
      organizationSlug,
      investigationId
    ).queryKey;
    void queryClient.invalidateQueries({queryKey: orchestrationKey});
    const interval = window.setInterval(
      () => void queryClient.invalidateQueries({queryKey: orchestrationKey}),
      2000
    );
    return () => window.clearInterval(interval);
  }, [investigationId, organizationSlug, pending?.acknowledged, queryClient]);

  const submitCommand = useCallback(
    (command: InvestigationOrchestrationCommand, target: OrchestrationCommandTarget) => {
      if (!orchestration || pending) {
        return;
      }
      const requestId = uuid4();
      setError(null);
      const pendingCommand: PendingCommand = {
        baseline: orchestration,
        command,
        requestId,
        submittedAt: Date.now(),
        target,
        transportRetryCount: 0,
      };
      setPending(pendingCommand);
      dispatchCommand(pendingCommand);
    },
    [dispatchCommand, orchestration, pending]
  );

  const commandState: OrchestrationCommandState = {
    error: error?.message ?? null,
    errorTarget: error?.target ?? null,
    isPending: Boolean(pending),
    pendingTarget: pending?.target ?? null,
  };
  const hideNotebookBlocks = pending
    ? doesCommandInvalidateReport(pending.command)
    : false;

  return {
    commandState,
    displayedOrchestration,
    hideNotebookBlocks,
    submitCommand,
  };
}

export function applyOptimisticOrchestrationCommand(
  orchestration: InvestigationOrchestration,
  command: InvestigationOrchestrationCommand,
  requestId: string
): InvestigationOrchestration {
  if (command.type === 'provide_input') {
    return {
      ...orchestration,
      phase: 'broad_scan',
      status: 'processing',
      broadScan: {...orchestration.broadScan, status: 'queued', error: null},
      pendingInput: null,
    };
  }
  if (command.type === 'add_hypothesis') {
    return {
      ...orchestration,
      phase:
        orchestration.broadScan.status === 'completed'
          ? 'investigating'
          : orchestration.phase,
      status: 'processing',
      hypotheses: [
        ...orchestration.hypotheses,
        {
          id: `optimistic-${requestId}`,
          order: Math.max(...orchestration.hypotheses.map(item => item.order), -1) + 1,
          statement: command.statement,
          rationale: command.rationale || t('User-proposed hypothesis.'),
          status: 'queued',
          effectiveStatus: 'pending',
          decisionSource: 'none',
          confidence: null,
          verificationSteps: [],
          evidence: [],
          error: null,
        },
      ],
      report: {...orchestration.report, status: 'waiting', error: null},
    };
  }
  if (command.type === 'set_hypothesis_disposition') {
    return {
      ...orchestration,
      status: 'processing',
      hypotheses: orchestration.hypotheses.map(hypothesis =>
        hypothesis.id === command.hypothesisId
          ? applyOptimisticDisposition(hypothesis, command.disposition)
          : hypothesis
      ),
      report: {...orchestration.report, status: 'waiting', error: null},
    };
  }
  if (command.type === 'steer') {
    if (command.target === 'workflow') {
      return {
        ...orchestration,
        phase: 'broad_scan',
        status: 'processing',
        broadScan: {
          ...orchestration.broadScan,
          status: 'queued',
          summary: null,
          error: null,
          toolActivity: [],
        },
        hypotheses: orchestration.hypotheses.map(hypothesis => ({
          ...hypothesis,
          status: 'cancelled',
          effectiveStatus: isActiveWorkStatus(hypothesis.status)
            ? 'cancelled'
            : hypothesis.effectiveStatus,
        })),
        report: {
          ...orchestration.report,
          status: 'waiting',
          currentBlockKey: null,
          currentBlockStatus: 'not_started',
          error: null,
        },
      };
    }
    if (command.target === 'hypothesis' && command.targetId) {
      return {
        ...orchestration,
        phase: 'investigating',
        hypotheses: orchestration.hypotheses.map(hypothesis =>
          hypothesis.id === command.targetId
            ? {
                ...hypothesis,
                status: 'queued',
                effectiveStatus: 'investigating',
                agentVerdict: null,
                confidence: null,
                decisionSource: 'none',
                evidence: [],
                toolActivity: [],
                error: null,
                verificationSteps: hypothesis.verificationSteps.map(step => ({
                  ...step,
                  status: 'not_started',
                  result: null,
                  evidence: [],
                  error: null,
                })),
              }
            : hypothesis
        ),
        report: {...orchestration.report, status: 'waiting', error: null},
      };
    }
    if (command.target === 'report' || command.target === 'block') {
      return {
        ...orchestration,
        phase: 'reporting',
        status: 'processing',
        report: {...orchestration.report, status: 'composing', error: null},
      };
    }
    return {...orchestration, status: 'processing'};
  }
  if (command.type === 'retry') {
    if (command.target === 'hypothesis' && command.targetId) {
      return {
        ...orchestration,
        phase: 'investigating',
        status: 'processing',
        hypotheses: orchestration.hypotheses.map(hypothesis =>
          hypothesis.id === command.targetId
            ? {
                ...hypothesis,
                status: 'queued',
                effectiveStatus: 'pending',
                agentVerdict: null,
                confidence: null,
                decisionSource: 'none',
                evidence: [],
                toolActivity: [],
                error: null,
                verificationSteps: hypothesis.verificationSteps.map(step => ({
                  ...step,
                  status: 'not_started',
                  result: null,
                  evidence: [],
                  error: null,
                })),
              }
            : hypothesis
        ),
        report: {...orchestration.report, status: 'waiting', error: null},
      };
    }
    if (command.target === 'report') {
      return {
        ...orchestration,
        phase: 'reporting',
        status: 'processing',
        report: {...orchestration.report, status: 'composing', error: null},
      };
    }
    return {
      ...orchestration,
      phase: 'broad_scan',
      status: 'processing',
      broadScan: {...orchestration.broadScan, status: 'queued', error: null},
      errors: [],
    };
  }
  return {
    ...orchestration,
    phase: 'cancelled',
    status: 'cancelled',
    broadScan: {
      ...orchestration.broadScan,
      status: isActiveWorkStatus(orchestration.broadScan.status)
        ? 'cancelled'
        : orchestration.broadScan.status,
    },
    hypotheses: orchestration.hypotheses.map(hypothesis => ({
      ...hypothesis,
      status: isActiveWorkStatus(hypothesis.status) ? 'cancelled' : hypothesis.status,
      effectiveStatus: isActiveWorkStatus(hypothesis.status)
        ? 'cancelled'
        : hypothesis.effectiveStatus,
    })),
    report: {
      ...orchestration.report,
      status: ['waiting', 'composing'].includes(orchestration.report.status)
        ? 'cancelled'
        : orchestration.report.status,
    },
  };
}

function applyOptimisticDisposition(
  hypothesis: InvestigationHypothesis,
  disposition: 'accepted' | 'rejected' | null
): InvestigationHypothesis {
  if (disposition === null) {
    return {
      ...hypothesis,
      decisionSource: hypothesis.agentVerdict ? 'agent' : 'none',
      effectiveStatus:
        hypothesis.agentVerdict?.verdict ?? getEffectiveStatus(hypothesis.status),
      status: hypothesis.agentVerdict ? 'completed' : 'queued',
    };
  }
  const cancelled = !hypothesis.agentVerdict && isActiveWorkStatus(hypothesis.status);
  return {
    ...hypothesis,
    decisionSource: 'user',
    effectiveStatus: disposition,
    status: cancelled ? 'cancelled' : hypothesis.status,
    verificationSteps: cancelled
      ? hypothesis.verificationSteps.map(step => ({
          ...step,
          status: isActiveWorkStatus(step.status) ? 'cancelled' : step.status,
        }))
      : hypothesis.verificationSteps,
  };
}

function isOrchestrationCommandReflected(
  orchestration: InvestigationOrchestration,
  pending: PendingCommand
) {
  const {command} = pending;
  if (command.type === 'provide_input') {
    return (
      orchestration.pendingInput === null && orchestration.status !== 'awaiting_input'
    );
  }
  if (command.type === 'add_hypothesis') {
    const baselineMatches = pending.baseline.hypotheses.filter(
      hypothesis => hypothesis.statement === command.statement
    ).length;
    return (
      orchestration.hypotheses.filter(
        hypothesis => hypothesis.statement === command.statement
      ).length > baselineMatches
    );
  }
  if (command.type === 'set_hypothesis_disposition') {
    const hypothesis = orchestration.hypotheses.find(
      item => item.id === command.hypothesisId
    );
    return command.disposition === null
      ? hypothesis?.decisionSource !== 'user'
      : hypothesis?.decisionSource === 'user' &&
          hypothesis.effectiveStatus === command.disposition;
  }
  if (command.type === 'steer') {
    return Boolean(
      orchestration.steeringIntents?.some(
        intent => intent.requestId === pending.requestId
      )
    );
  }
  if (command.type === 'retry') {
    if (command.target === 'report') {
      return orchestration.report.revision > pending.baseline.report.revision;
    }
    if (command.target === 'hypothesis' && command.targetId) {
      const current = orchestration.hypotheses.find(
        hypothesis => hypothesis.id === command.targetId
      );
      const baseline = pending.baseline.hypotheses.find(
        hypothesis => hypothesis.id === command.targetId
      );
      return Boolean(
        current && baseline && current.status !== baseline.status && !current.error
      );
    }
    return (
      orchestration.broadScan.status !== pending.baseline.broadScan.status &&
      !orchestration.broadScan.error
    );
  }
  return orchestration.status === 'cancelled';
}

function getNewCommandError(
  orchestration: InvestigationOrchestration,
  pending: PendingCommand
): CommandProjectionError | null {
  const {command} = pending;
  const newGlobalError = orchestration.errors.find(
    error =>
      (!error.requestId || error.requestId === pending.requestId) &&
      !pending.baseline.errors.some(
        previous =>
          previous.code === error.code && previous.occurredAt === error.occurredAt
      )
  );
  if (
    newGlobalError?.code === 'seer_command_dispatch_failed' &&
    newGlobalError.requestId === pending.requestId
  ) {
    return {
      message: newGlobalError.message,
      retryTransport: newGlobalError.retryable,
    };
  }
  if (command.type === 'retry' && command.target === 'hypothesis') {
    const current = orchestration.hypotheses.find(
      hypothesis => hypothesis.id === command.targetId
    );
    const previous = pending.baseline.hypotheses.find(
      hypothesis => hypothesis.id === command.targetId
    );
    if (current?.error && current.error.occurredAt !== previous?.error?.occurredAt) {
      return {message: current.error.message, retryTransport: false};
    }
  }
  if (command.type === 'retry' && command.target === 'report') {
    if (
      orchestration.report.error &&
      orchestration.report.error.occurredAt !== pending.baseline.report.error?.occurredAt
    ) {
      return {
        message: orchestration.report.error.message,
        retryTransport: false,
      };
    }
  }
  return null;
}

function getEffectiveStatus(status: InvestigationHypothesis['status']) {
  if (status === 'running') {
    return 'investigating' as const;
  }
  if (status === 'failed' || status === 'cancelled') {
    return status;
  }
  return 'pending' as const;
}

function isActiveWorkStatus(status: string) {
  return ['queued', 'running', 'blocked', 'reauth_required', 'stalled'].includes(status);
}

function doesCommandInvalidateReport(command: InvestigationOrchestrationCommand) {
  return (
    command.type === 'add_hypothesis' ||
    command.type === 'set_hypothesis_disposition' ||
    (command.type === 'steer' &&
      (command.target === 'workflow' || command.target === 'hypothesis')) ||
    (command.type === 'retry' && command.target === 'hypothesis')
  );
}
