from unittest import mock

import pytest

from sentry import deletions
from sentry.constants import ObjectStatus
from sentry.deletions.defaults.organizationintegration import OrganizationIntegrationDeletionTask
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions_control
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.shared_integrations.exceptions import IntegrationDeletionInProgressError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity


@control_silo_test
class DeleteOrganizationIntegrationTest(TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self) -> None:
        org = self.create_organization()
        integration, organization_integration = self.create_provider_integration_for(
            org, self.user, provider="example", name="Example"
        )

        with assume_test_silo_mode(SiloMode.CELL):
            external_issue = ExternalIssue.objects.create(
                organization_id=org.id, integration_id=integration.id, key="ABC-123"
            )

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks(), outbox_runner():
            run_scheduled_deletions_control()

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

        with assume_test_silo_mode(SiloMode.CELL):
            # TODO: When external issue -> organization is a hybrid cloud foreign key, test this is deleted via that route.
            assert ExternalIssue.objects.filter(id=external_issue.id).exists()

    def test_skip_on_undelete(self) -> None:
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks():
            run_scheduled_deletions_control()

        assert OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

    @with_feature("organizations:integrations-deletion-reinstall-cas")
    def test_reinstall_cancels_pending_deletion(self) -> None:
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(instance=organization_integration, days=0)

        reactivated = integration.add_organization(org, self.user)
        assert reactivated is not None
        assert reactivated.id == organization_integration.id
        assert reactivated.status == ObjectStatus.ACTIVE
        assert not ScheduledDeletion.objects.filter(id=deletion.id).exists()

        with self.tasks():
            run_scheduled_deletions_control()

        assert OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

    @with_feature("organizations:integrations-deletion-reinstall-cas")
    def test_reinstall_after_deletion_task_read_the_row(self) -> None:
        """
        The scheduled deletion task checks `should_proceed` against a copy of the
        row that it read before it started. A reinstall landing in that window
        used to be deleted anyway, because the deletion re-queried by id only.
        """
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(instance=organization_integration, days=0)

        real_should_proceed = OrganizationIntegrationDeletionTask.should_proceed

        def reinstall_then_proceed(
            task: OrganizationIntegrationDeletionTask, instance: OrganizationIntegration
        ) -> bool:
            # `instance` was read while still PENDING_DELETION, so this returns
            # True even though the row is ACTIVE again by the time it does.
            integration.add_organization(org, self.user)
            return real_should_proceed(task, instance)

        with mock.patch.object(
            OrganizationIntegrationDeletionTask, "should_proceed", reinstall_then_proceed
        ):
            with self.tasks():
                run_scheduled_deletions_control()

        assert (
            OrganizationIntegration.objects.get(id=organization_integration.id).status
            == ObjectStatus.ACTIVE
        )
        assert not ScheduledDeletion.objects.filter(id=deletion.id).exists()

    @with_feature("organizations:integrations-deletion-reinstall-cas")
    def test_delete_bulk_skips_rows_reactivated_after_selection(self) -> None:
        """
        `chunk` selects rows without locking them, so a reinstall can land
        between the select and the delete. The claim must catch that.
        """
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)

        task = deletions.get(
            model=OrganizationIntegration, query={"id": organization_integration.id}
        )
        assert isinstance(task, OrganizationIntegrationDeletionTask)

        # The stale copy the task selected, before the reinstall commits.
        stale = OrganizationIntegration.objects.get(id=organization_integration.id)
        assert stale.status == ObjectStatus.PENDING_DELETION

        reactivated = integration.add_organization(org, self.user)
        assert reactivated is not None
        assert reactivated.status == ObjectStatus.ACTIVE

        assert task.delete_bulk([stale]) is False
        assert (
            OrganizationIntegration.objects.get(id=organization_integration.id).status
            == ObjectStatus.ACTIVE
        )

    @with_feature("organizations:integrations-deletion-reinstall-cas")
    def test_reinstall_refused_while_deletion_in_progress(self) -> None:
        """
        Once the deletion has claimed the row its children are being torn down,
        so the row cannot be handed back as a successful install.
        """
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        organization_integration.update(status=ObjectStatus.DELETION_IN_PROGRESS)

        with pytest.raises(IntegrationDeletionInProgressError):
            integration.add_organization(org, self.user)

        assert (
            OrganizationIntegration.objects.get(id=organization_integration.id).status
            == ObjectStatus.DELETION_IN_PROGRESS
        )

    def test_reinstall_legacy_behavior_without_feature(self) -> None:
        """
        With the flag off, add_organization keeps the pre-existing behavior:
        no CAS rescue, no rejection, no scheduled-deletion cancellation.
        """
        org = self.create_organization()
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(instance=organization_integration, days=0)

        reinstalled = integration.add_organization(org, self.user)
        assert reinstalled is not None
        assert reinstalled.status == ObjectStatus.PENDING_DELETION
        assert ScheduledDeletion.objects.filter(id=deletion.id).exists()

        with self.tasks():
            run_scheduled_deletions_control()

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()

    def test_repository_and_identity(self) -> None:
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

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
            assert Project.objects.filter(id=project.id).exists()
            # TODO: When external issue -> organization is a hybrid cloud foreign key, test this is deleted via that route.
            assert ExternalIssue.objects.filter(id=external_issue.id).exists()
            repo = Repository.objects.get(id=repository.id)
            assert repo.integration_id is None

    def test_codeowner_links(self) -> None:
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
        with assume_test_silo_mode(SiloMode.CELL):
            # We expect to delete all associated Code Owners and Code Mappings
            assert not ProjectCodeOwners.objects.filter(id=code_owner.id).exists()
            assert not RepositoryProjectPathConfig.objects.filter(id=code_owner.id).exists()

    def test_seer_project_repository_links(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        integration = self.create_provider_integration(provider="example", name="Example")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None
        repository = self.create_repo(
            project=project, name="testrepo", provider="gitlab", integration_id=integration.id
        )

        with assume_test_silo_mode(SiloMode.CELL):
            seer_repo = self.create_seer_project_repository(
                project=project, repository_id=repository.id
            )

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks():
            run_scheduled_deletions_control()

        assert not OrganizationIntegration.objects.filter(id=organization_integration.id).exists()
        with assume_test_silo_mode(SiloMode.CELL):
            assert not SeerProjectRepository.objects.filter(id=seer_repo.id).exists()

    def test_seer_automation_handoff_options_links(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        other_project = self.create_project(organization=org)
        integration = self.create_provider_integration(provider="example", name="Example")
        other_integration = self.create_provider_integration(provider="slack", name="Slack")
        organization_integration = integration.add_organization(org, self.user)
        assert organization_integration is not None

        with assume_test_silo_mode(SiloMode.CELL):
            project.update_option("sentry:seer_automation_handoff_integration_id", integration.id)
            project.update_option("sentry:seer_automation_handoff_point", "root_cause")
            project.update_option(
                "sentry:seer_automation_handoff_target", "cursor_background_agent"
            )
            project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)
            other_project.update_option(
                "sentry:seer_automation_handoff_integration_id", other_integration.id
            )
            other_project.update_option("sentry:seer_automation_handoff_point", "root_cause")

        organization_integration.update(status=ObjectStatus.PENDING_DELETION)
        ScheduledDeletion.schedule(instance=organization_integration, days=0)

        with self.tasks():
            run_scheduled_deletions_control()

        with assume_test_silo_mode(SiloMode.CELL):
            assert not ProjectOption.objects.filter(
                project_id=project.id,
                key__in={
                    "sentry:seer_automation_handoff_integration_id",
                    "sentry:seer_automation_handoff_point",
                    "sentry:seer_automation_handoff_target",
                    "sentry:seer_automation_handoff_auto_create_pr",
                },
            ).exists()
            # Other integration's options are untouched
            assert (
                other_project.get_option("sentry:seer_automation_handoff_integration_id")
                == other_integration.id
            )
            assert other_project.get_option("sentry:seer_automation_handoff_point") == "root_cause"
