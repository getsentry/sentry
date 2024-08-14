from django.conf import settings
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model
from sentry.db.models.base import region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.escalation_policies.models.rotation_schedule import RotationSchedule
from sentry.models.team import Team


@region_silo_model
class EscalationPolicy(Model):
    """
    Escalation policies are a scheduled ordering of steps that occur until an incident is acknowledged.
    Each step can fire notifications to any combination of schedules, users and/or teams.
    Policies can be repeated N times.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    # Owner
    team = models.ForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    repeat_n_times = models.PositiveIntegerField(default=1)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_escalation_policy"


@region_silo_model
class EscalationPolicyStep(Model):
    """
    A step in an escalation policy.
    """

    __relocation_scope__ = RelocationScope.Organization

    policy = models.ForeignKey(EscalationPolicy, on_delete=models.CASCADE, related_name="steps")
    step_number = models.PositiveIntegerField()
    escalate_after_sec = models.PositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_escalation_policy_step"
        unique_together = (("policy", "step_number"),)
        ordering = ["step_number"]


@region_silo_model
class EscalationPolicyStepRecipient(Model):
    """
    A recipient of an escalation policy step.
    """

    __relocation_scope__ = RelocationScope.Organization

    escalation_policy_step = models.ForeignKey(
        EscalationPolicyStep, on_delete=models.CASCADE, related_name="recipients"
    )
    schedule = FlexibleForeignKey(RotationSchedule, null=True, on_delete=models.CASCADE)
    team = FlexibleForeignKey(Team, null=True, on_delete=models.CASCADE)
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="CASCADE")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_escalation_policy_step_recipient"
