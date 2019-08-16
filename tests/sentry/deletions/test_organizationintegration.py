from __future__ import absolute_import

from sentry.models import ExternalIssue, Integration, OrganizationIntegration, ScheduledDeletion
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteOrganizationIntegrationTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(org, self.user)
        organization_integration = OrganizationIntegration.objects.get(
            integration_id=integration.id, organization_id=org.id
        )
        external_issue = ExternalIssue.objects.create(
            organization_id=org.id, integration_id=integration.id, key="ABC-123"
        )

        deletion = ScheduledDeletion.schedule(organization_integration, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
