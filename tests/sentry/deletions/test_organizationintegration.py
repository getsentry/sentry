from sentry.constants import ObjectStatus
from sentry.models import (
    ExternalIssue,
    Identity,
    Integration,
    OrganizationIntegration,
    Project,
    Repository,
    ScheduledDeletion,
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TransactionTestCase


class DeleteOrganizationIntegrationTest(TransactionTestCase):
    def test_simple(self):
        org = self.create_organization()
        integration = Integration.objects.create(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        external_issue = ExternalIssue.objects.create(
            organization_id=org.id, integration_id=integration.id, key="ABC-123"
        )

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(organization_integration, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        assert not ExternalIssue.objects.filter(id=external_issue.id).exists()

    def test_skip_on_undelete(self):
        org = self.create_organization()
        integration = Integration.objects.create(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)

        deletion = ScheduledDeletion.schedule(organization_integration, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

    def test_repository_and_identity(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = Integration.objects.create(provider="example", name="Example")
        provider = self.create_identity_provider(integration)
        identity = self.create_identity(
            user=self.user, identity_provider=provider, external_id="abc123"
        )
        organization_integration = integration.add_organization(org, self.user, identity.id)
        repository = self.create_repo(
            project=project, name="testrepo", provider="gitlab", integration_id=integration.id
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=org.id, integration_id=integration.id, key="ABC-123"
        )
        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(organization_integration, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert Integration.objects.filter(id=integration.id).exists()
        assert Project.objects.filter(id=project.id).exists()
        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        assert not ExternalIssue.objects.filter(id=external_issue.id).exists()
        assert not Identity.objects.filter(id=identity.id).exists()

        repo = Repository.objects.get(id=repository.id)
        assert repo.integration_id is None
