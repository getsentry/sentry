from sentry.constants import ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions_control
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.repository import Repository
from sentry.models.scheduledeletion import ScheduledDeletion
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity


@control_silo_test
class DeleteOrganizationIntegrationTest(TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self):
        org = self.create_organization()
        integration, organization_integration = self.create_provider_integration_for(
            org, self.user, provider="example", name="Example"
        )

        with assume_test_silo_mode(SiloMode.REGION):
            external_issue = ExternalIssue.objects.create(
                organization_id=org.id, integration_id=integration.id, key="ABC-123"
            )

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks(), outbox_runner():
            run_scheduled_deletions_control()

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

        with assume_test_silo_mode(SiloMode.REGION):
            # TODO: When external issue -> organization is a hybrid cloud foreign key, test this is deleted via that route.
            assert ExternalIssue.objects.filter(id=external_issue.id).exists()

    def test_skip_on_undelete(self):
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks():
            run_scheduled_deletions_control()

        assert OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

    def test_repository_and_identity(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = self.create_provider_integration(provider="example", name="Example")
        provider = self.create_identity_provider(integration)
        identity = self.create_identity(
            user=self.user, identity_provider=provider, external_id="abc123"
        )
        organization_integration = integration.add_organization(org, self.user, identity.id)
        assert organization_integration is not None
        repository = self.create_repo(
            project=project, name="testrepo", provider="gitlab", integration_id=integration.id
        )

        with assume_test_silo_mode(SiloMode.REGION):
            external_issue = ExternalIssue.objects.create(
                organization_id=org.id, integration_id=integration.id, key="ABC-123"
            )
        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks():
            run_scheduled_deletions_control()

        assert Integration.objects.filter(id=integration.id).exists()
        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        assert not Identity.objects.filter(id=identity.id).exists()

        with assume_test_silo_mode(SiloMode.REGION):
            assert Project.objects.filter(id=project.id).exists()
            # TODO: When external issue -> organization is a hybrid cloud foreign key, test this is deleted via that route.
            assert ExternalIssue.objects.filter(id=external_issue.id).exists()
            repo = Repository.objects.get(id=repository.id)
            assert repo.integration_id is None

    def test_codeowner_links(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = self.create_provider_integration(provider="example", name="Example")
        repository = self.create_repo(
            project=project, name="testrepo", provider="gitlab", integration_id=integration.id
        )
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        code_mapping = self.create_code_mapping(
            project=project, repo=repository, organization_integration=organization_integration
        )
        code_owner = self.create_codeowners(project=project, code_mapping=code_mapping)

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks():
            run_scheduled_deletions_control()

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        with assume_test_silo_mode(SiloMode.REGION):
            # We expect to delete all associated Code Owners and Code Mappings
            assert not ProjectCodeOwners.objects.filter(id=code_owner.id).exists()
            assert not RepositoryProjectPathConfig.objects.filter(id=code_owner.id).exists()
