import pytest
from django.db import ProgrammingError, transaction

from sentry.models import Integration, ProjectIntegration
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits


@control_silo_test(stable=True)
class IntegrationTest(TestCase):
    def test_cannot_delete_with_queryset(self):
        org = self.create_organization()
        integration = self.create_integration(org, "blahblah")
        assert Integration.objects.count() == 1
        with pytest.raises(ProgrammingError), transaction.atomic():
            Integration.objects.filter(id=integration.id).delete()
        assert Integration.objects.count() == 1

    def test_hybrid_cloud_deletion(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = self.create_integration(org, "blahblah")
        int_id = integration.id
        with exempt_from_silo_limits():
            ProjectIntegration.objects.create(project=project, integration_id=integration.id)

            with outbox_runner():
                integration.delete()

        assert not Integration.objects.filter(id=int_id).exists()

        # cascade is asynchronous, ensure there is still related search,
        with exempt_from_silo_limits():
            assert ProjectIntegration.objects.filter(integration_id=int_id).exists()
            with self.tasks():
                schedule_hybrid_cloud_foreign_key_jobs()

        # Ensure they are all now gone.
        with exempt_from_silo_limits():
            assert not ProjectIntegration.objects.filter(integration_id=int_id).exists()
