from sentry.models import Integration, PagerDutyService, ProjectIntegration
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test(stable=True)
class IntegrationTest(TestCase):
    def test_hybrid_cloud_deletion(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = self.create_integration(org, "blahblah")
        org_int = integration.add_organization(org)
        int_id = integration.id

        with assume_test_silo_mode(SiloMode.REGION):
            ProjectIntegration.objects.create(project=project, integration_id=integration.id)
            pds = PagerDutyService.objects.create(
                organization_integration_id=org_int.id,
                organization_id=org.id,
                integration_id=integration.id,
                integration_key="abcdef",
                service_name="this_is_a_service",
            )

        with outbox_runner(), assume_test_silo_mode(SiloMode.MONOLITH):
            integration.delete()

        assert not Integration.objects.filter(id=int_id).exists()

        with assume_test_silo_mode(SiloMode.REGION):
            # cascade is asynchronous, ensure there is still related search,
            assert ProjectIntegration.objects.filter(integration_id=int_id).exists()

            with self.tasks():
                schedule_hybrid_cloud_foreign_key_jobs()

            # Ensure they are all now gone.
            assert not PagerDutyService.objects.filter(id=pds.id).exists()
            assert not ProjectIntegration.objects.filter(integration_id=int_id).exists()
