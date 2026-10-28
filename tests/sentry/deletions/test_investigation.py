from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockParameter,
    InvestigationComment,
    InvestigationParameter,
    InvestigationProject,
)
from sentry.models.organization import Organization, OrganizationStatus
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteInvestigationTest(TransactionTestCase, HybridCloudTestMixin):
    """The old tables keep their rows until they're dropped, so their deletions still run."""

    def setUp(self) -> None:
        super().setUp()
        self.investigation = Investigation.objects.create(
            organization=self.organization, title="Investigation"
        )
        InvestigationProject.objects.create(investigation=self.investigation, project=self.project)
        parameter = InvestigationParameter.objects.create(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        block = InvestigationBlock.objects.create(
            investigation=self.investigation, position=0, kind="text"
        )
        upstream = InvestigationBlock.objects.create(
            investigation=self.investigation, position=1, kind="text"
        )
        InvestigationBlockDependency.objects.create(block=block, depends_on=upstream)
        InvestigationBlockParameter.objects.create(block=block, parameter=parameter)
        InvestigationComment.objects.create(
            investigation=self.investigation, block=block, body="A comment"
        )
        execution = InvestigationBlockExecution.objects.create(
            block=block, executor="manual", block_version=1, input_fingerprint="f" * 64
        )
        InvestigationBlockExecutionProject.objects.create(execution=execution, project=self.project)

    def assert_investigation_deleted(self) -> None:
        assert not Investigation.objects.filter(id=self.investigation.id).exists()
        assert not InvestigationProject.objects.exists()
        assert not InvestigationParameter.objects.exists()
        assert not InvestigationBlock.objects.exists()
        assert not InvestigationBlockDependency.objects.exists()
        assert not InvestigationBlockParameter.objects.exists()
        assert not InvestigationComment.objects.exists()
        assert not InvestigationBlockExecution.objects.exists()
        assert not InvestigationBlockExecutionProject.objects.exists()

    def test_simple(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.investigation, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_investigation_deleted()

    def test_delete_organization_cascades_to_investigations(self) -> None:
        org = self.organization
        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Organization.objects.filter(id=org.id).exists()
        self.assert_investigation_deleted()
