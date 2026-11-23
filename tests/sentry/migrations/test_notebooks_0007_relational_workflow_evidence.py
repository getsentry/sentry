from django.db.migrations.state import StateApps

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class WorkflowEvidenceMigrationTest(TestMigrations):
    app = "notebooks"
    migrate_from = "0006_workflow_notebooks"
    migrate_to = "0007_relational_workflow_evidence"

    def setup_before_migration(self, apps: StateApps) -> None:
        with unguarded_write(using="default"):
            org = apps.get_model("sentry", "Organization").objects.create(slug="scope-migration")
        notebook = apps.get_model("notebooks", "Notebook")
        project = apps.get_model("sentry", "Project").objects.create(
            organization_id=org.id, slug="app"
        )
        self.project_id = project.id
        self.plain = notebook.objects.create(organization_id=org.id)
        self.org_wide = notebook.objects.create(organization_id=org.id, workflow_project_ids=[])
        self.selected = notebook.objects.create(
            organization_id=org.id, workflow_project_ids=[project.id, -1]
        )

    def test_preserves_evidence_scope_including_deleted_projects(self) -> None:
        notebook = self.apps.get_model("notebooks", "Notebook")
        evidence = self.apps.get_model("notebooks", "NotebookEvidenceProject")
        assert notebook.objects.get(pk=self.plain.pk).workflow_evidence_scope == "none"
        assert notebook.objects.get(pk=self.org_wide.pk).workflow_evidence_scope == "organization"
        assert notebook.objects.get(pk=self.selected.pk).workflow_evidence_scope == "projects"
        assert set(
            evidence.objects.filter(notebook_id=self.selected.pk).values_list(
                "project_id", flat=True
            )
        ) == {self.project_id, None}
