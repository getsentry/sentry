from __future__ import absolute_import

from sentry.models import (
    ExternalIssue, Integration, OrganizationIntegration, ProjectIntegration, ScheduledDeletion
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteOrganizationIntegrationTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)
        integration.add_project(project.id)
        organization_integration = OrganizationIntegration.objects.get(
            integration_id=integration.id,
            organization_id=org.id,
        )
        project_integration = ProjectIntegration.objects.get(
            integration_id=integration.id,
            project__organization=org,
        )
        external_issue = ExternalIssue.objects.create(
            organization_id=org.id,
            integration_id=integration.id,
            key='ABC-123',
        )

        deletion = ScheduledDeletion.schedule(organization_integration, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
        assert not ProjectIntegration.objects.filter(id=project_integration.id).exists()
