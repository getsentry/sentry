from django.db.migrations.state import StateApps

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class WorkflowEvidenceMigrationTest(TestMigrations):
    app = "notebooks"
    migrate_from = "0005_add_comment_mentions"
    migrate_to = "0006_workflow_notebooks"

    def setup_before_migration(self, apps: StateApps) -> None:
        with unguarded_write(using="default"):
            org = apps.get_model("sentry", "Organization").objects.create(slug="scope-migration")
        project = apps.get_model("sentry", "Project").objects.create(
            organization_id=org.id, slug="app"
        )
        notebook = apps.get_model("notebooks", "Notebook").objects.create(organization_id=org.id)
        apps.get_model("notebooks", "NotebookProject").objects.create(
            notebook_id=notebook.id, project_id=project.id
        )
        self.notebook_id = notebook.id
        self.project_id = project.id

    def test_existing_notebook_keeps_its_selection_without_gaining_workflow_evidence(self) -> None:
        notebook = self.apps.get_model("notebooks", "Notebook").objects.get(pk=self.notebook_id)
        assert notebook.workflow_evidence_scope == "none"
        assert not notebook.evidence_project_links.exists()
        assert (
            self.apps.get_model("notebooks", "NotebookProject")
            .objects.filter(notebook_id=notebook.id, project_id=self.project_id)
            .exists()
        )
