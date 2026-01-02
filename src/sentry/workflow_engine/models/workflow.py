from __future__ import annotations

import logging
from dataclasses import replace
from typing import Any, ClassVar, TypedDict

from django.conf import settings
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.owner_base import OwnerModel
from sentry.workflow_engine.models.data_condition import DataCondition, is_slow_condition
from sentry.workflow_engine.models.data_condition_group import (
    DataConditionGroup,
    DataConditionGroupSnapshot,
)
from sentry.workflow_engine.processors.data_condition_group import TriggerResult
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

from .json_config import JSONConfigBase

logger = logging.getLogger(__name__)


class WorkflowSnapshot(TypedDict):
    id: int
    enabled: bool
    environment_id: int | None
    status: int
    triggers: DataConditionGroupSnapshot | None


class WorkflowManager(BaseManager["Workflow"]):
    def get_queryset(self) -> BaseQuerySet[Workflow]:
        return (
            super()
            .get_queryset()
            .exclude(status__in=(ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS))
        )


@region_silo_model
class Workflow(DefaultFieldsModel, OwnerModel, JSONConfigBase):
    """
    A workflow is a way to execute actions in a specified order.
    Workflows are initiated after detectors have been processed, driven by changes to their state.
    """

    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[WorkflowManager] = WorkflowManager()
    objects_for_deletion: ClassVar[BaseManager] = BaseManager()

    name = models.CharField(max_length=256)
    organization = FlexibleForeignKey("sentry.Organization")

    # If the workflow is not enabled, it will not be evaluated / invoke actions. This is how we "snooze" a workflow
    enabled = models.BooleanField(db_default=True)

    # The workflow's status - used for tracking deletion state
    status = models.SmallIntegerField(db_default=ObjectStatus.ACTIVE)

    # Required as the 'when' condition for the workflow, this evaluates states emitted from the detectors
    when_condition_group = FlexibleForeignKey(
        "workflow_engine.DataConditionGroup", null=True, blank=True, db_index=False
    )

    environment = FlexibleForeignKey("sentry.Environment", null=True, blank=True)

    created_by_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete="SET_NULL"
    )

    DEFAULT_FREQUENCY = 30

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Workflow Schema",
        "type": "object",
        "properties": {
            "frequency": {
                "description": "How often the workflow should fire for a Group (minutes)",
                "type": "integer",
                "minimum": 0,
            },
        },
        "additionalProperties": False,
    }

    __repr__ = sane_repr("organization_id")

    class Meta:
        app_label = "workflow_engine"
        db_table = "workflow_engine_workflow"
        constraints = [
            models.UniqueConstraint(
                fields=["when_condition_group_id"],
                name="workflow_engine_workflow_when_condition_group_id_11d9ba05_uniq",
            ),
        ]

    def get_audit_log_data(self) -> dict[str, Any]:
        return {"name": self.name}

    def get_snapshot(self) -> WorkflowSnapshot:
        when_condition_group = None
        if self.when_condition_group:
            when_condition_group = self.when_condition_group.get_snapshot()

        environment_id = None
        if self.environment:
            environment_id = self.environment.id

        return {
            "id": self.id,
            "enabled": self.enabled,
            "environment_id": environment_id,
            "status": self.status,
            "triggers": when_condition_group,
        }

    def evaluate_trigger_conditions(
        self, event_data: WorkflowEventData, when_data_conditions: list[DataCondition] | None = None
    ) -> tuple[TriggerResult, list[DataCondition]]:
        """
        Evaluate the conditions for the workflow trigger and return if the evaluation was successful.
        If there aren't any workflow trigger conditions, the workflow is considered triggered.
        """
        # TODO - investigate circular import issue
        from sentry.workflow_engine.processors.data_condition_group import (
            process_data_condition_group,
        )

        if self.when_condition_group_id is None:
            return TriggerResult.TRUE, []

        workflow_event_data = replace(event_data, workflow_env=self.environment)
        try:
            group = DataConditionGroup.objects.get_from_cache(id=self.when_condition_group_id)
        except DataConditionGroup.DoesNotExist:
            # This isn't expected under normal conditions, but weird things can happen in the
            # midst of deletions and migrations.
            logger.exception(
                "DataConditionGroup does not exist",
                extra={"id": self.when_condition_group_id},
            )
            return TriggerResult(False, ConditionError(msg="DataConditionGroup does not exist")), []
        group_evaluation, remaining_conditions = process_data_condition_group(
            group, workflow_event_data, when_data_conditions
        )
        return group_evaluation.logic_result, remaining_conditions


def get_slow_conditions(workflow: Workflow) -> list[DataCondition]:
    if not workflow.when_condition_group:
        return []

    slow_conditions = [
        condition
        for condition in workflow.when_condition_group.conditions.all()
        if is_slow_condition(condition)
    ]
    return slow_conditions


@receiver(pre_save, sender=Workflow)
def enforce_config_schema(sender, instance: Workflow, **kwargs):
    instance.validate_config(instance.config_schema)
