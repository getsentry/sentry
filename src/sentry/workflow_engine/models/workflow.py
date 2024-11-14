from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.types import DataConditionResult


@region_silo_model
class Workflow(DefaultFieldsModel):
    """
    A workflow is a way to execute actions in a specified order.
    Workflows are initiated after detectors have been processed, driven by changes to their state.
    """

    __relocation_scope__ = RelocationScope.Organization
    name = models.CharField(max_length=200)
    organization = FlexibleForeignKey("sentry.Organization")

    # Required as the 'when' condition for the workflow, this evalutes states emitted from the detectors
    when_condition_group = FlexibleForeignKey(DataConditionGroup, blank=True, null=True)

    __repr__ = sane_repr("name", "organization_id")

    class Meta:
        app_label = "workflow_engine"
        db_table = "workflow_engine_workflow"

        constraints = [
            models.UniqueConstraint(
                fields=["name", "organization"], name="unique_workflow_name_per_org"
            )
        ]

    # TODO should the value here _only_ be trigger conditions?
    # How can we limit it to that? Trigger conditions should be: new issue created, issue state change, etc
    def evaluate_trigger_conditions(self, value: Any) -> tuple[bool, list[DataConditionResult]]:
        """
        Evaluate the conditions for the workflow trigger and return the results.
        If there isn't a when_condition_group, the workflow should always trigger.
        """
        if self.when_condition_group is None:
            return (True, [])

        # TODO - should this iterate over the results and make decisions?
        return evaluate_condition_group(self.when_condition_group, value)
