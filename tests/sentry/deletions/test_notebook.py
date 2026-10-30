from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockExecutionProject,
    NotebookComment,
    NotebookFavoriteUser,
    NotebookProject,
    NotebookSeen,
)
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteNotebookTest(TransactionTestCase, HybridCloudTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Notebook"
        )
        self.notebook_project = self.create_notebook_project(
            notebook=self.notebook, project=self.project
        )
        self.favorite = self.create_notebook_favorite(notebook=self.notebook, user=self.user)
        self.seen = self.create_notebook_seen(notebook=self.notebook, user=self.user)

        self.block = self.create_notebook_block(notebook=self.notebook, position=0)
        self.other_block = self.create_notebook_block(notebook=self.notebook, position=1)
        self.comment = self.create_notebook_comment(notebook=self.notebook, author=self.user)
        self.block_comment = self.create_notebook_comment(
            notebook=self.notebook, author=self.user, block=self.block
        )
        self.action_request = self.create_notebook_action_request(notebook=self.notebook)
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.notebook
        )

        self.execution = self.create_notebook_block_execution(
            block=self.block, executor="code_mode", block_version=1, input_fingerprint="f" * 64
        )
        self.execution_project = self.create_notebook_block_execution_project(
            execution=self.execution, project=self.project
        )
        self.stale_execution = self.create_notebook_block_execution(
            block=self.block, executor="code_mode", block_version=1, input_fingerprint="e" * 64
        )
        self.block.update(
            current_execution=self.execution,
            content_execution=self.execution,
            result_execution=self.execution,
        )

    def assert_notebook_deleted(self) -> None:
        assert not Notebook.objects.filter(id=self.notebook.id).exists()
        assert not NotebookProject.objects.filter(id=self.notebook_project.id).exists()
        assert not NotebookFavoriteUser.objects.filter(id=self.favorite.id).exists()
        assert not NotebookSeen.objects.filter(id=self.seen.id).exists()
        assert not NotebookComment.objects.filter(
            id__in=[self.comment.id, self.block_comment.id]
        ).exists()
        assert not NotebookActionRequest.objects.filter(id=self.action_request.id).exists()
        assert not NotebookBlock.objects.filter(
            id__in=[self.block.id, self.other_block.id]
        ).exists()
        assert not NotebookBlockExecution.objects.filter(
            id__in=[self.execution.id, self.stale_execution.id]
        ).exists()
        assert not NotebookBlockExecutionProject.objects.filter(
            id=self.execution_project.id
        ).exists()
        assert not InvestigationOrchestrationRun.objects.filter(
            id=self.orchestration_run.id
        ).exists()

    def test_simple(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.notebook, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_notebook_deleted()

    def test_leaves_sibling_notebook_intact(self) -> None:
        other = self.create_notebook(organization=self.organization, title="Other")
        other_block = self.create_notebook_block(notebook=other)
        other_execution = self.create_notebook_block_execution(
            block=other_block, executor="code_mode", block_version=1, input_fingerprint="a" * 64
        )
        other_execution_project = self.create_notebook_block_execution_project(
            execution=other_execution, project=self.project
        )

        self.ScheduledDeletion.schedule(instance=self.notebook, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_notebook_deleted()
        assert Notebook.objects.filter(id=other.id).exists()
        assert NotebookBlock.objects.filter(id=other_block.id).exists()
        assert NotebookBlockExecution.objects.filter(id=other_execution.id).exists()
        assert NotebookBlockExecutionProject.objects.filter(id=other_execution_project.id).exists()

    def test_delete_organization_cascades_to_notebooks(self) -> None:
        org = self.organization
        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        self.assert_notebook_deleted()

    def test_delete_project_only_removes_project_links(self) -> None:
        project = self.project
        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not NotebookProject.objects.filter(id=self.notebook_project.id).exists()
        assert not NotebookBlockExecutionProject.objects.filter(
            id=self.execution_project.id
        ).exists()

        # The notebook itself is org-scoped and outlives any one project.
        assert Notebook.objects.filter(id=self.notebook.id).exists()
        assert NotebookBlock.objects.filter(id=self.block.id).exists()
        assert NotebookBlockExecution.objects.filter(id=self.execution.id).exists()
