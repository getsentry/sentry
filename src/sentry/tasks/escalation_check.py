import logging
from datetime import UTC, datetime, timedelta

from django.db import router, transaction

from sentry.escalation_policies import (
    EscalationNotification,
    EscalationPolicyState,
    EscalationPolicyStateType,
    EscalationPolicyStep,
)
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)

# TODO: Add a heart beat process that starts any delayed or failed escalation checks?


@instrumented_task(
    name="sentry.tasks.escalation_check",
    max_retries=3,
)
def escalation_check(*args, escalation_policy_state_id: int, **kwds):
    try:
        with transaction.atomic(router.db_for_write(EscalationPolicyState)):
            state = (
                EscalationPolicyState.objects.filter(
                    id=escalation_policy_state_id,
                    run_step_at__lte=datetime.now(UTC),
                    state=EscalationPolicyStateType.UNACKNOWLEDGED,
                )
                .prefetch_related("escalation_policy", "escalation_policy__steps")
                .select_for_update()
                .get()
            )

            if state.run_step_at > datetime.now(UTC):
                escalation_check.apply_async(
                    kwargs=dict(escalation_policy_state_id=escalation_policy_state_id),
                    countdown=(datetime.now(UTC) - state.run_step_at).total_seconds(),
                )
                return

            policy = state.escalation_policy
            steps = list(policy.steps.all())
            n_steps = len(steps)
            total_iterations = n_steps * policy.repeat_n_times

            # Nothing, to do, mark it resolved and clear it.
            if total_iterations <= 0:
                state.state = EscalationPolicyStateType.RESOLVED
                state.save()
                return

            step: EscalationPolicyStep
            if state.run_step_n < total_iterations:
                step = steps[state.run_step_n % n_steps]
                state.run_step_n += 1
            else:
                # TODO: Do we want a state for "missed"?
                state.state = EscalationPolicyStateType.RESOLVED
                state.save()
                return

            state.run_step_at = datetime.now(UTC) + timedelta(seconds=step.escalate_after_sec)
            state.save()
        # do not do this inside of a transaction, best effort send this after state is updated.
        EscalationNotification(group=state.group, recipients=list(step.recipients.all())).send()
        escalation_check.apply_async(
            kwargs=dict(escalation_policy_state_id=escalation_policy_state_id),
            countdown=step.escalate_after_sec,
        )
    except EscalationPolicyState.DoesNotExist:
        return
