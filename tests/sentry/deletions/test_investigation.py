from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellDependency,
    InvestigationCellExecution,
    InvestigationCellExecutionProject,
    InvestigationCellParameter,
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

        self.cell = self.create_investigation_cell(investigation=self.investigation, position=0)
        self.upstream_cell = self.create_investigation_cell(
            investigation=self.investigation, position=1
        )
        self.dependency = self.create_investigation_cell_dependency(
            cell=self.cell, depends_on=self.upstream_cell
        )
        self.cell_parameter = self.create_investigation_cell_parameter(
            cell=self.cell, parameter=self.parameter
        )

        self.execution = self.create_investigation_cell_execution(
            cell=self.cell, executor="manual", cell_version=1, input_fingerprint="f" * 64
        )
        self.execution_project = self.create_investigation_cell_execution_project(
            execution=self.execution, project=self.project
        )
        self.cell.update(
            current_execution=self.execution,
            content_execution=self.execution,
            result_execution=self.execution,
        )

    def assert_investigation_deleted(self) -> None:
        assert not Investigation.objects.filter(id=self.investigation.id).exists()
        assert not InvestigationProject.objects.filter(id=self.investigation_project.id).exists()
        assert not InvestigationFavoriteUser.objects.filter(id=self.favorite.id).exists()
        assert not InvestigationParameter.objects.filter(id=self.parameter.id).exists()
        assert not InvestigationCell.objects.filter(
            id__in=[self.cell.id, self.upstream_cell.id]
        ).exists()
        assert not InvestigationCellDependency.objects.filter(id=self.dependency.id).exists()
        assert not InvestigationCellParameter.objects.filter(id=self.cell_parameter.id).exists()
        assert not InvestigationCellExecution.objects.filter(id=self.execution.id).exists()
        assert not InvestigationCellExecutionProject.objects.filter(
            id=self.execution_project.id
        ).exists()

    def test_simple(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.investigation, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_investigation_deleted()

    def test_leaves_sibling_investigation_intact(self) -> None:
        other = self.create_investigation(organization=self.organization, title="Other")
        other_cell = self.create_investigation_cell(investigation=other)

        self.ScheduledDeletion.schedule(instance=self.investigation, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_investigation_deleted()
        assert Investigation.objects.filter(id=other.id).exists()
        assert InvestigationCell.objects.filter(id=other_cell.id).exists()

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
        project.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not InvestigationProject.objects.filter(id=self.investigation_project.id).exists()
        assert not InvestigationCellExecutionProject.objects.filter(
            id=self.execution_project.id
        ).exists()

        # The investigation itself is org-scoped and outlives any one project.
        assert Investigation.objects.filter(id=self.investigation.id).exists()
        assert InvestigationCell.objects.filter(id=self.cell.id).exists()
        assert InvestigationCellExecution.objects.filter(id=self.execution.id).exists()
