from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.escalation_policies.models.escalation_policy import EscalationPolicy
from sentry.models.group import Group


class EscalationPolicyStateType(models.TextChoices):
    UNACKNOWLEDGED = "unacknowledged", gettext_lazy("Unacknowledged")
    ACKNOWLEDGED = "acknowledged", gettext_lazy("Acknowledged")
    RESOLVED = "resolved", gettext_lazy("Resolved")

    @classmethod
    def get_choices(cls) -> list[tuple[str, str]]:
        return [(key.value, key.name) for key in cls]


class EscalationPolicyState(models.Model):
    """
    An instance of EscalationPolicyState will be created whenever a new escalation policy is triggered.

    A materialized “current state” of a triggered escalation policy is useful in that it allows us to
    query state for active incidents, see what is unacknowledged at a glance, and quickly determine
    the next steps that will be taken.
    """

    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    escalation_policy = models.ForeignKey(EscalationPolicy, on_delete=models.CASCADE)
    run_step_n = models.PositiveIntegerField(null=True)
    run_step_at = models.DateTimeField(null=True)
    state = models.CharField(max_length=32, choices=EscalationPolicyStateType.choices)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "escalation_policies"
        db_table = "escalation_policies_escalation_policy_state"
