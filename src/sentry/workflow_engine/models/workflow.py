from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr

from .data_condition_group import DataConditionGroup
from .detector import DetectorStateData


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
    detectors = models.ManyToManyField(
        "workflow_engine.Detector", through="workflow_engine.DetectorWorkflow"
    )

    # TODO - make a db migration for this
    # The workflow can be disabled in the UI, if it's disabled it will always evaluate the conditions to False
    enabled = models.BooleanField(default=True)

    __repr__ = sane_repr("name", "organization_id")

    class Meta:
        app_label = "workflow_engine"
        db_table = "workflow_engine_workflow"

        constraints = [
            models.UniqueConstraint(
                fields=["name", "organization"], name="unique_workflow_name_per_org"
            )
        ]

    def evaluate_when_condition_group(self, detector_state: DetectorStateData) -> bool:
        """
        Evaluate the when_condition_group for the workflow.

        This will always be true if there are no conditions, and always be false if the workflow is disabled.
        """

        # If there isn't a condition group, it always passes the condition check
        if self.when_condition_group is None:
            return True

        # If the workflow is disabled, it never passes the condition check
        if not self.enabled:
            return False

        # TODO - figure out what the DetectorStateData is that maps to this;
        #      - should we have a custom DataCondition to evaluate the detector state?
        #      - should we simplify the DetectorStateData and just worry about a subset of the data here?

        return self.when_condition_group.evaluate(detector_state.status)
