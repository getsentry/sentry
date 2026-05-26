from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.runner.commands.deletions import deletions
from sentry.testutils.cases import CliTestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity


@control_silo_test
class DeletionsCliTest(CliTestCase):
    command = deletions

    def _schedule_org_integration_deletion(self) -> tuple[ScheduledDeletion, int]:
        """Create an OrganizationIntegration and schedule it for deletion."""
        integration = self.create_provider_integration(
            provider="slack", name="Slack", external_id="slack:1"
        )
        identity = Identity.objects.create(
            idp=self.create_identity_provider(type="slack", config={}, external_id="slack:1"),
            user=self.user,
            external_id="base_id",
            data={},
        )
        integration.add_organization(self.organization, self.user, default_auth_id=identity.id)
        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        org_integration.update(status=ObjectStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(org_integration, days=0, actor=self.user)
        return deletion, org_integration.id

    def test_list_empty(self) -> None:
        rv = self.invoke("list")
        assert rv.exit_code == 0
        assert "No pending deletions found" in rv.output

    def test_list_shows_pending(self) -> None:
        deletion, _ = self._schedule_org_integration_deletion()
        rv = self.invoke("list")
        assert rv.exit_code == 0
        assert "ScheduledDeletion" in rv.output
        assert "OrganizationIntegration" in rv.output
        assert str(deletion.id) in rv.output

    def test_list_filter_by_model(self) -> None:
        self._schedule_org_integration_deletion()
        rv = self.invoke("list", "-m", "OrganizationIntegration")
        assert rv.exit_code == 0
        assert "OrganizationIntegration" in rv.output

    def test_list_filter_by_model_no_match(self) -> None:
        self._schedule_org_integration_deletion()
        rv = self.invoke("list", "-m", "Project")
        assert rv.exit_code == 0
        assert "No pending deletions found" in rv.output

    def test_run_requires_option(self) -> None:
        rv = self.invoke("run")
        assert rv.exit_code != 0
        assert "Provide one of" in rv.output

    def test_run_by_id(self) -> None:
        deletion, oi_id = self._schedule_org_integration_deletion()
        rv = self.invoke("run", "-i", str(deletion.id))
        assert rv.exit_code == 0, rv.output
        assert "Done" in rv.output
        assert not OrganizationIntegration.objects.filter(id=oi_id).exists()
        assert not ScheduledDeletion.objects.filter(id=deletion.id).exists()

    def test_run_by_model(self) -> None:
        deletion, oi_id = self._schedule_org_integration_deletion()
        rv = self.invoke("run", "-m", "OrganizationIntegration")
        assert rv.exit_code == 0, rv.output
        assert "Done" in rv.output
        assert not OrganizationIntegration.objects.filter(id=oi_id).exists()

    def test_run_all(self) -> None:
        deletion, oi_id = self._schedule_org_integration_deletion()
        rv = self.invoke("run", "--all")
        assert rv.exit_code == 0, rv.output
        assert "Done" in rv.output
        assert not OrganizationIntegration.objects.filter(id=oi_id).exists()

    def test_run_nonexistent_id(self) -> None:
        rv = self.invoke("run", "-i", "99999")
        assert rv.exit_code == 0
        assert "not found" in rv.output
        assert "ScheduledDeletion" in rv.output

    def test_run_nonexistent_cell_id(self) -> None:
        rv = self.invoke("run", "--cid", "99999")
        assert rv.exit_code == 0
        assert "not found" in rv.output
        assert "CellScheduledDeletion" in rv.output

    def test_run_no_pending(self) -> None:
        rv = self.invoke("run", "--all")
        assert rv.exit_code == 0
        assert "No pending deletions found" in rv.output
