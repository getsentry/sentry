from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


class SeerWorkflowStrategy(models.TextChoices):
    AGENTIC_TRIAGE = "agentic_triage"


class SeerWorkflowSchedule(models.TextChoices):
    DAILY = "daily"


@cell_silo_model
class SeerWorkflowConfig(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    strategy = models.CharField(max_length=256, choices=SeerWorkflowStrategy.choices)
    enabled = models.BooleanField(default=False)
    schedule = models.CharField(
        max_length=256, choices=SeerWorkflowSchedule.choices, default=SeerWorkflowSchedule.DAILY
    )
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_workflowconfig"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "strategy"], name="seer_workflowconfig_org_strategy_uniq"
            ),
        ]

    __repr__ = sane_repr("organization_id", "strategy", "enabled")

    @classmethod
    def get_or_create_for_strategy(
        cls, organization_id: int, strategy: SeerWorkflowStrategy
    ) -> SeerWorkflowConfig:
        config, _ = cls.objects.get_or_create(
            organization_id=organization_id,
            strategy=strategy.value,
        )
        return config
