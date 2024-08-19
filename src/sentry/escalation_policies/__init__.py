from datetime import UTC, datetime

from sentry.escalation_policies.logic import coalesce_schedule_layers
from sentry.escalation_policies.models.escalation_policy import EscalationPolicy
from sentry.escalation_policies.models.escalation_policy_state import (
    EscalationPolicyState,
    EscalationPolicyStateType,
)
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule
from sentry.models.group import Group


# Take a rotation schedule and a time and return the user ID for the oncall user
def determine_schedule_oncall(
    schedule: RotationSchedule, time: datetime | None = None
) -> int | None:
    if time is None:
        time = datetime.now(UTC)
    rotation_periods = coalesce_schedule_layers(schedule.layers.all(), time, time)

    if len(rotation_periods) == 0:
        return None

    return rotation_periods[0]["user_id"]


def trigger_escalation_policy(policy: EscalationPolicy, group: Group) -> EscalationPolicyState:
    return EscalationPolicyState.objects.create(
        escalation_policy=policy,
        state=EscalationPolicyStateType.UNACKNOWLEDGED,
        run_step_n=0,
        run_step_at=datetime.now(UTC),
        group=group,
    )


# TODO: cleanup any outstanding scheduled jobs for this policy state
def alter_escalation_policy_state(
    policy_state: EscalationPolicyState, new_state: EscalationPolicyStateType
) -> EscalationPolicyState:
    policy_state.state = new_state
    policy_state.save()
    return policy_state
