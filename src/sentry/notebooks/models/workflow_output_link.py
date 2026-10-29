from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class SeerWorkflowOutputLink(DefaultFieldsModel):
    """A many-to-many link between SeerWorkflowRunExecution (automation run shard) and related outputs.

    One execution can produce many outputs (e.g. an orchestrator that starts several
    investigations). Each row links a single output; output columns are nullable so 
    multiple output types can be added.
    """

    __relocation_scope__ = RelocationScope.Excluded

    execution = FlexibleForeignKey(
        "seer.SeerWorkflowRunExecution", on_delete=models.CASCADE, related_name="output_links"
    )
    notebook = FlexibleForeignKey(
        "notebooks.Notebook",
        on_delete=models.CASCADE,
        null=True,
        related_name="workflow_output_links",
    )

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_seerworkflowoutputlink"
        constraints = [
            models.UniqueConstraint(
                fields=["execution", "notebook"],
                condition=models.Q(notebook__isnull=False),
                name="seerworkflowoutputlink_execution_notebook_uniq",
            ),
        ]

    __repr__ = sane_repr("execution_id", "notebook_id")
