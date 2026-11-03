from datetime import datetime, timezone
from importlib import import_module
from types import SimpleNamespace

import pytest
from django.db import connections

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations

migration = import_module("sentry.notebooks.migrations.0002_copy_from_investigations")

OLD = datetime(2020, 9, 1, tzinfo=timezone.utc)


@pytest.mark.skip(reason="Migration already applied; test is slow and only useful before merge")
class CopyFromInvestigationsTest(TestMigrations):
    app = "notebooks"
    migrate_from = "0001_initial"
    migrate_to = "0002_copy_from_investigations"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Project = apps.get_model("sentry", "Project")
        Investigation = apps.get_model("investigations", "Investigation")
        InvestigationProject = apps.get_model("investigations", "InvestigationProject")
        InvestigationFavoriteUser = apps.get_model("investigations", "InvestigationFavoriteUser")
        InvestigationSeen = apps.get_model("investigations", "InvestigationSeen")
        InvestigationBlock = apps.get_model("investigations", "InvestigationBlock")
        InvestigationBlockExecution = apps.get_model(
            "investigations", "InvestigationBlockExecution"
        )
        InvestigationBlockExecutionProject = apps.get_model(
            "investigations", "InvestigationBlockExecutionProject"
        )
        InvestigationActionRequest = apps.get_model("investigations", "InvestigationActionRequest")
        InvestigationComment = apps.get_model("investigations", "InvestigationComment")

        with unguarded_write(using="default"):
            organization = Organization.objects.create(slug="notebook-copy", name="Notebook copy")
        project = Project.objects.create(organization_id=organization.id, slug="app", name="App")

        self.manual = Investigation.objects.create(
            organization_id=organization.id, created_by_id=7, title="Manual notebook"
        )
        InvestigationProject.objects.create(investigation=self.manual, project=project)
        self.favorite = InvestigationFavoriteUser.objects.create(
            investigation=self.manual, user_id=7
        )
        InvestigationSeen.objects.create(investigation=self.manual, user_id=7)
        self.block = InvestigationBlock.objects.create(
            investigation=self.manual, position=0, kind="text", content="Hello"
        )
        self.execution = InvestigationBlockExecution.objects.create(
            block=self.block,
            executor="text_generation",
            status="completed",
            block_version=1,
            input_fingerprint="f" * 64,
        )
        InvestigationBlockExecutionProject.objects.create(execution=self.execution, project=project)
        InvestigationBlock.objects.filter(id=self.block.id).update(
            current_execution=self.execution, content_execution=self.execution
        )
        InvestigationActionRequest.objects.create(
            investigation=self.manual,
            key="next",
            report_revision=2,
            primary=True,
            title="Next step",
            rationale="Because",
        )
        InvestigationComment.objects.create(
            investigation=self.manual, block=self.block, author_id=7, body="On the block"
        )

        self.snapshot = {"monitor": {"name": "Checkout errors"}}
        self.agentic = Investigation.objects.create(
            organization_id=organization.id,
            title="Metric breach",
            source_type="metric_open_period",
            source={
                "type": "metric_open_period",
                "ref": {"groupId": "11", "openPeriodId": "22"},
                "snapshot": self.snapshot,
            },
            source_key="a" * 64,
            lineage_key="a" * 64,
            source_revision=1,
            filters={"environment": ["production"], "breachedMetric": self.snapshot},
        )
        InvestigationBlock.objects.create(
            investigation=self.agentic,
            position=0,
            kind="text",
            stable_agent_key="summary",
            report_revision=3,
        )

        self.template = Investigation.objects.create(
            organization_id=organization.id,
            title="Template notebook",
            template_key="breached_metric",
            template_version=1,
            source_type="breached_metric",
            source_key="b" * 64,
            source_revision=1,
        )
        self.template_block = InvestigationBlock.objects.create(
            investigation=self.template, position=0, kind="text"
        )
        InvestigationComment.objects.create(investigation=self.template, body="Skipped")

        Investigation.objects.update(date_added=OLD, date_updated=OLD)

    def test_copies_notebooks_and_can_run_again(self):
        Investigation = self.apps.get_model("investigations", "Investigation")
        InvestigationFavoriteUser = self.apps.get_model(
            "investigations", "InvestigationFavoriteUser"
        )
        InvestigationComment = self.apps.get_model("investigations", "InvestigationComment")
        Notebook = self.apps.get_model("notebooks", "Notebook")
        NotebookBlock = self.apps.get_model("notebooks", "NotebookBlock")
        NotebookBlockExecutionProject = self.apps.get_model(
            "notebooks", "NotebookBlockExecutionProject"
        )
        NotebookActionRequest = self.apps.get_model("notebooks", "NotebookActionRequest")
        NotebookComment = self.apps.get_model("notebooks", "NotebookComment")
        NotebookFavoriteUser = self.apps.get_model("notebooks", "NotebookFavoriteUser")

        assert set(Notebook.objects.values_list("id", flat=True)) == {
            self.manual.id,
            self.agentic.id,
        }
        assert not NotebookBlock.objects.filter(id=self.template_block.id).exists()
        assert not NotebookComment.objects.filter(notebook_id=self.template.id).exists()

        manual = Notebook.objects.get(id=self.manual.id)
        assert manual.title == "Manual notebook"
        assert manual.created_by_id == 7
        assert manual.source_key is None
        assert (manual.date_added, manual.date_updated) == (OLD, OLD)

        agentic = Notebook.objects.get(id=self.agentic.id)
        assert agentic.source_key == "metric_open_period:11:22"
        assert agentic.filters == {"environment": ["production"]}
        assert agentic.source["snapshot"] == self.snapshot

        block = NotebookBlock.objects.get(id=self.block.id)
        assert block.notebook_id == self.manual.id
        assert block.current_execution_id == self.execution.id
        assert block.content_execution_id == self.execution.id
        assert NotebookBlockExecutionProject.objects.filter(execution_id=self.execution.id).exists()
        agentic_block = NotebookBlock.objects.get(notebook_id=self.agentic.id)
        assert (agentic_block.producer_key, agentic_block.producer_revision) == ("summary", 3)
        action_request = NotebookActionRequest.objects.get(notebook_id=self.manual.id)
        assert (action_request.producer_revision, action_request.primary) == (2, True)
        assert NotebookFavoriteUser.objects.filter(id=self.favorite.id).exists()

        written_after_switch = Notebook.objects.create(
            organization_id=manual.organization_id, title="New"
        )
        assert written_after_switch.id >= self.template.id + migration.ID_GAP

        Investigation.objects.filter(id=self.manual.id).update(
            title="Renamed", date_updated=datetime.now(timezone.utc)
        )
        InvestigationFavoriteUser.objects.filter(id=self.favorite.id).delete()
        new_comment = InvestigationComment.objects.create(
            investigation_id=self.manual.id, body="Late"
        )
        migration.copy_from_investigations(
            self.apps, SimpleNamespace(connection=connections["default"])
        )

        assert Notebook.objects.get(id=self.manual.id).title == "Renamed"
        assert not NotebookFavoriteUser.objects.filter(id=self.favorite.id).exists()
        assert NotebookComment.objects.filter(id=new_comment.id).exists()
        assert Notebook.objects.filter(id=written_after_switch.id).exists()
