from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockParameter,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationProject,
)
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteInvestigationTest(TransactionTestCase, HybridCloudTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.investigation_project = self.create_investigation_project(
            investigation=self.investigation, project=self.project
        )
        self.favorite = self.create_investigation_favorite(
            investigation=self.investigation, user=self.user
        )

        self.parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )

        self.block = self.create_investigation_block(investigation=self.investigation, position=0)
        self.upstream_block = self.create_investigation_block(
            investigation=self.investigation, position=1
        )
        self.dependency = self.create_investigation_block_dependency(
            block=self.block, depends_on=self.upstream_block
        )
        self.block_parameter = self.create_investigation_block_parameter(
            block=self.block, parameter=self.parameter
        )

        self.execution = self.create_investigation_block_execution(
            block=self.block, executor="manual", block_version=1, input_fingerprint="f" * 64
        )
        self.execution_project = self.create_investigation_block_execution_project(
            execution=self.execution, project=self.project
        )
        self.stale_execution = self.create_investigation_block_execution(
            block=self.block, executor="manual", block_version=1, input_fingerprint="e" * 64
        )
        self.block.update(
            current_execution=self.execution,
            content_execution=self.execution,
            result_execution=self.execution,
        )

    def assert_investigation_deleted(self) -> None:
        assert not Investigation.objects.filter(id=self.investigation.id).exists()
        assert not InvestigationProject.objects.filter(id=self.investigation_project.id).exists()
        assert not InvestigationFavoriteUser.objects.filter(id=self.favorite.id).exists()
        assert not InvestigationParameter.objects.filter(id=self.parameter.id).exists()
        assert not InvestigationBlock.objects.filter(
            id__in=[self.block.id, self.upstream_block.id]
        ).exists()
        assert not InvestigationBlockDependency.objects.filter(id=self.dependency.id).exists()
        assert not InvestigationBlockParameter.objects.filter(id=self.block_parameter.id).exists()
        assert not InvestigationBlockExecution.objects.filter(
            id__in=[self.execution.id, self.stale_execution.id]
        ).exists()
        assert not InvestigationBlockExecutionProject.objects.filter(
            id=self.execution_project.id
        ).exists()

    def test_simple(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.investigation, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_investigation_deleted()

    def test_leaves_sibling_investigation_intact(self) -> None:
        other = self.create_investigation(organization=self.organization, title="Other")
        other_parameter = self.create_investigation_parameter(
            investigation=other, key="env", label="Env", type="string", position=0
        )
        other_block = self.create_investigation_block(investigation=other)
        other_block_parameter = self.create_investigation_block_parameter(
            block=other_block, parameter=other_parameter
        )
        other_execution = self.create_investigation_block_execution(
            block=other_block, executor="manual", block_version=1, input_fingerprint="a" * 64
        )
        other_execution_project = self.create_investigation_block_execution_project(
            execution=other_execution, project=self.project
        )

        self.ScheduledDeletion.schedule(instance=self.investigation, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_investigation_deleted()
        assert Investigation.objects.filter(id=other.id).exists()
        assert InvestigationParameter.objects.filter(id=other_parameter.id).exists()
        assert InvestigationBlock.objects.filter(id=other_block.id).exists()
        assert InvestigationBlockParameter.objects.filter(id=other_block_parameter.id).exists()
        assert InvestigationBlockExecution.objects.filter(id=other_execution.id).exists()
        assert InvestigationBlockExecutionProject.objects.filter(
            id=other_execution_project.id
        ).exists()

    def test_delete_organization_cascades_to_investigations(self) -> None:
        org = self.organization
        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        self.assert_investigation_deleted()

    def test_delete_project_only_removes_project_links(self) -> None:
        project = self.project
        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not InvestigationProject.objects.filter(id=self.investigation_project.id).exists()
        assert not InvestigationBlockExecutionProject.objects.filter(
            id=self.execution_project.id
        ).exists()

        # The investigation itself is org-scoped and outlives any one project.
        assert Investigation.objects.filter(id=self.investigation.id).exists()
        assert InvestigationBlock.objects.filter(id=self.block.id).exists()
        assert InvestigationBlockExecution.objects.filter(id=self.execution.id).exists()
