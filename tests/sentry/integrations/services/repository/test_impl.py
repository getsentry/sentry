from typing import Any
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.repository.model import RpcRepointIntegrationResult
from sentry.integrations.services.repository.serial import serialize_repository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.types import ExternalProviders
from sentry.models.grouplink import GroupLink
from sentry.models.options.project_option import ProjectOption
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, cell_silo_test


@all_silo_test
class ScheduleGitlabProjectWebhooksTest(TestCase):
    @patch("sentry.integrations.services.repository.impl.update_all_project_webhooks.delay")
    def test_force_is_forwarded(self, delay: MagicMock) -> None:
        repository_service.schedule_update_gitlab_project_webhooks(
            organization_id=self.organization.id, integration_id=123, force=True
        )
        delay.assert_called_once_with(
            organization_id=self.organization.id, integration_id=123, force=True
        )

    @patch("sentry.integrations.services.repository.impl.update_all_project_webhooks.delay")
    def test_older_callers_default_to_debounce(self, delay: MagicMock) -> None:
        repository_service.schedule_update_gitlab_project_webhooks(
            organization_id=self.organization.id, integration_id=123
        )
        delay.assert_called_once_with(
            organization_id=self.organization.id, integration_id=123, force=False
        )

    @patch("sentry.integrations.services.repository.impl.update_all_project_webhooks.delay")
    def test_force_survives_serialization(self, delay: MagicMock) -> None:
        dispatch_to_local_service(
            "repository",
            "schedule_update_gitlab_project_webhooks",
            {"organization_id": self.organization.id, "integration_id": 123, "force": True},
        )
        delay.assert_called_once_with(
            organization_id=self.organization.id, integration_id=123, force=True
        )


@cell_silo_test
class DisableRepositoriesByExternalIdsTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"

    def test_disables_matching_active_repos(self) -> None:
        repo1 = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        repo2 = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/snuba",
            external_id="200",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100", "200"],
        )

        repo1.refresh_from_db()
        repo2.refresh_from_db()
        assert repo1.status == ObjectStatus.DISABLED
        assert repo2.status == ObjectStatus.DISABLED

    def test_does_not_disable_already_disabled_repos(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.DISABLED,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED

    def test_does_not_affect_repos_from_other_integrations(self) -> None:
        other_integration = self.create_integration(
            organization=self.organization,
            external_id="2",
            provider="github",
        )
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=other_integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE

    def test_does_not_affect_repos_from_other_orgs(self) -> None:
        other_org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=other_org.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE

    def test_only_disables_specified_external_ids(self) -> None:
        repo_to_disable = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        repo_to_keep = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/snuba",
            external_id="200",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo_to_disable.refresh_from_db()
        repo_to_keep.refresh_from_db()
        assert repo_to_disable.status == ObjectStatus.DISABLED
        assert repo_to_keep.status == ObjectStatus.ACTIVE

    def test_empty_external_ids_is_noop(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=[],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE


@cell_silo_test
class DisableRepositoriesForIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"

    def test_disables_matching_active_repos(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED


@cell_silo_test
class DisassociateOrganizationIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"
        self.org_integration = self.integration.organizationintegration_set.first()

    def test_disassociates_repos(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disassociate_organization_integration(
            organization_id=self.organization.id,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
        )

        repo.refresh_from_db()
        assert repo.integration_id is None


@cell_silo_test
class TransferRepositoryToIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.provider = "integrations:github"
        self.old_integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
        )
        self.old_org_integration = self.old_integration.organizationintegration_set.get()
        self.new_integration = self.create_integration(
            organization=self.organization, external_id="2", provider="github"
        )
        self.new_org_integration = self.new_integration.organizationintegration_set.get()
        self.repo = self.create_repo(
            project=self.project,
            name="old-org/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.old_integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            repo=self.repo,
            organization_integration=self.old_org_integration,
        )

    def _transfer(self) -> bool:
        update = serialize_repository(self.repo)
        update.name = "new-org/sentry"
        update.integration_id = self.new_integration.id
        update.status = ObjectStatus.ACTIVE
        return repository_service.transfer_repository_to_integration(
            organization_id=self.organization.id,
            update=update,
            organization_integration_id=self.new_org_integration.id,
        )

    def test_moves_repo_and_code_mappings(self) -> None:
        assert self._transfer() is True

        self.repo.refresh_from_db()
        assert self.repo.integration_id == self.new_integration.id
        assert self.repo.name == "new-org/sentry"
        self.code_mapping.refresh_from_db()
        assert self.code_mapping.integration_id == self.new_integration.id
        assert self.code_mapping.organization_integration_id == self.new_org_integration.id

    def test_returns_false_when_repo_deleted(self) -> None:
        update = serialize_repository(self.repo)
        self.repo.delete()

        assert (
            repository_service.transfer_repository_to_integration(
                organization_id=self.organization.id,
                update=update,
                organization_integration_id=self.new_org_integration.id,
            )
            is False
        )
        assert not Repository.objects.filter(id=update.id).exists()

    def test_returns_false_when_repo_pending_deletion(self) -> None:
        Repository.objects.filter(id=self.repo.id).update(status=ObjectStatus.PENDING_DELETION)

        assert self._transfer() is False

        self.repo.refresh_from_db()
        assert self.repo.status == ObjectStatus.PENDING_DELETION
        assert self.repo.integration_id == self.old_integration.id
        assert self.repo.name == "old-org/sentry"
        self.code_mapping.refresh_from_db()
        assert self.code_mapping.integration_id == self.old_integration.id
        assert self.code_mapping.organization_integration_id == self.old_org_integration.id


@cell_silo_test
class RepointOrganizationIntegrationDataTest(TestCase):
    def setUp(self) -> None:
        self.old_integration = self.create_integration(
            organization=self.organization,
            external_id="gitlab.example.com:1",
            provider="gitlab",
        )
        self.organization_integration = self.old_integration.organizationintegration_set.get()
        self.new_integration = self.create_integration(
            organization=self.organization,
            external_id=f"gitlab.example.com:1-{self.organization.id}",
            provider="gitlab",
        )

    def _repoint(self) -> RpcRepointIntegrationResult:
        return repository_service.repoint_organization_integration_data(
            organization_id=self.organization.id,
            old_integration_id=self.old_integration.id,
            new_integration_id=self.new_integration.id,
        )

    def test_repoints_all_cell_data(self) -> None:
        repository = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            integration_id=self.old_integration.id,
        )
        code_mapping = self.create_code_mapping(
            project=self.project,
            repo=repository,
            organization_integration=self.organization_integration,
        )
        external_issue = ExternalIssue.objects.create(
            organization=self.organization,
            integration_id=self.old_integration.id,
            key="issue-1",
        )
        external_actor = ExternalActor.objects.create(
            organization=self.organization,
            integration_id=self.old_integration.id,
            provider=ExternalProviders.GITLAB.value,
            external_name="@user",
            external_id="user-1",
            team=self.team,
        )
        self.project.update_option(
            "sentry:seer_automation_handoff_integration_id",
            self.old_integration.id,
        )

        with self.captureOnCommitCallbacks(execute=True):
            result = self._repoint()

        assert result.repositories == 1
        assert result.code_mappings == 1
        assert result.external_issues == 1
        assert result.external_actors == 1
        assert result.project_options == 1

        repository.refresh_from_db()
        assert repository.integration_id == self.new_integration.id
        code_mapping.refresh_from_db()
        assert code_mapping.integration_id == self.new_integration.id
        assert code_mapping.organization_integration_id == self.organization_integration.id
        external_issue.refresh_from_db()
        assert external_issue.integration_id == self.new_integration.id
        external_actor.refresh_from_db()
        assert external_actor.integration_id == self.new_integration.id
        assert (
            self.project.get_option("sentry:seer_automation_handoff_integration_id")
            == self.new_integration.id
        )

    def test_does_not_repoint_another_organization(self) -> None:
        other_organization = self.create_organization()
        repository = self.create_repo(
            project=self.create_project(organization=other_organization),
            provider="integrations:gitlab",
            integration_id=self.old_integration.id,
        )
        repository_on_another_integration = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            integration_id=self.new_integration.id,
        )
        external_issue = ExternalIssue.objects.create(
            organization=other_organization,
            integration_id=self.old_integration.id,
            key="issue-1",
        )

        result = self._repoint()

        assert result.repositories == 0
        assert result.external_issues == 0
        repository.refresh_from_db()
        assert repository.integration_id == self.old_integration.id
        repository_on_another_integration.refresh_from_db()
        assert repository_on_another_integration.integration_id == self.new_integration.id
        external_issue.refresh_from_db()
        assert external_issue.integration_id == self.old_integration.id

    def test_retry_is_noop(self) -> None:
        repository = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            integration_id=self.old_integration.id,
        )

        first_result = self._repoint()
        second_result = self._repoint()

        assert first_result.repositories == 1
        assert second_result.repositories == 0
        assert second_result.code_mappings == 0
        assert second_result.external_issues == 0
        assert second_result.external_actors == 0
        assert second_result.project_options == 0
        repository.refresh_from_db()
        assert repository.integration_id == self.new_integration.id

    def test_merges_external_issue_conflict(self) -> None:
        repository = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            integration_id=self.old_integration.id,
        )
        stale_issue = ExternalIssue.objects.create(
            organization=self.organization,
            integration_id=self.old_integration.id,
            key="issue-1",
        )
        survivor = ExternalIssue.objects.create(
            organization=self.organization,
            integration_id=self.new_integration.id,
            key="issue-1",
        )
        second_stale_issue = ExternalIssue.objects.create(
            organization=self.organization,
            integration_id=self.old_integration.id,
            key="issue-2",
        )
        second_survivor = ExternalIssue.objects.create(
            organization=self.organization,
            integration_id=self.new_integration.id,
            key="issue-2",
        )
        first_group = self.create_group(project=self.project)
        second_group = self.create_group(project=self.project)
        third_group = self.create_group(project=self.project)
        self.create_group_link(
            group=first_group,
            linked_id=stale_issue.id,
            linked_type=GroupLink.LinkedType.issue,
        )
        self.create_group_link(
            group=second_group,
            linked_id=stale_issue.id,
            linked_type=GroupLink.LinkedType.issue,
        )
        self.create_group_link(
            group=second_group,
            linked_id=survivor.id,
            linked_type=GroupLink.LinkedType.issue,
        )
        self.create_group_link(
            group=third_group,
            linked_id=second_stale_issue.id,
            linked_type=GroupLink.LinkedType.issue,
        )

        result = self._repoint()

        assert result.external_issues == 2
        repository.refresh_from_db()
        assert repository.integration_id == self.new_integration.id
        assert not ExternalIssue.objects.filter(id=stale_issue.id).exists()
        assert not ExternalIssue.objects.filter(id=second_stale_issue.id).exists()
        assert set(
            GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                linked_id=survivor.id,
            ).values_list("group_id", flat=True)
        ) == {first_group.id, second_group.id}
        assert GroupLink.objects.filter(
            group_id=third_group.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=second_survivor.id,
        ).exists()

    def test_retry_invalidates_project_option_cache(self) -> None:
        option_key = "sentry:seer_automation_handoff_integration_id"
        self.project.update_option(option_key, self.new_integration.id)

        with (
            patch.object(ProjectOption.objects, "reload_cache") as reload_cache,
            self.captureOnCommitCallbacks(execute=True),
        ):
            result = self._repoint()

        assert result.project_options == 0
        reload_cache.assert_called_once_with(
            self.project.id,
            "repository_service.repoint_organization_integration_data",
            option_key,
        )

    def test_result_survives_rpc_serialization(self) -> None:
        response = dispatch_to_local_service(
            "repository",
            "repoint_organization_integration_data",
            {
                "organization_id": self.organization.id,
                "old_integration_id": self.old_integration.id,
                "new_integration_id": self.new_integration.id,
            },
        )

        assert response["value"] == {
            "repositories": 0,
            "code_mappings": 0,
            "external_issues": 0,
            "external_actors": 0,
            "project_options": 0,
        }


@cell_silo_test
class UpdateRepositoryConfigTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization, external_id="1", provider="gitlab"
        )
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            integration_id=self.integration.id,
        )
        self.repo.update(config={"project_id": 1, "webhook_id": 10})

    def _update(self, **kwargs: Any) -> bool:
        return repository_service.update_repository_config(
            organization_id=self.organization.id,
            id=self.repo.id,
            config_updates={"webhook_id": 20},
            **kwargs,
        )

    def test_merges_only_the_given_keys(self) -> None:
        # Written after the caller's snapshot; a full-row write would drop it.
        self.repo.update(name="renamed", config={**self.repo.config, "sync_comments": True})

        assert self._update(
            expected_integration_id=self.integration.id, expected_config={"webhook_id": 10}
        )

        self.repo.refresh_from_db()
        assert self.repo.name == "renamed"
        assert self.repo.config == {"project_id": 1, "webhook_id": 20, "sync_comments": True}

    def test_refuses_inactive_repository(self) -> None:
        for status in (ObjectStatus.DISABLED, ObjectStatus.PENDING_DELETION):
            self.repo.update(status=status)

            assert self._update() is False

            self.repo.refresh_from_db()
            assert self.repo.status == status
            assert self.repo.config["webhook_id"] == 10

    def test_refuses_repository_moved_to_another_integration(self) -> None:
        other = self.create_integration(
            organization=self.organization, external_id="2", provider="gitlab"
        )
        self.repo.update(integration_id=other.id)

        assert self._update(expected_integration_id=self.integration.id) is False

        self.repo.refresh_from_db()
        assert self.repo.integration_id == other.id
        assert self.repo.config["webhook_id"] == 10

    def test_refuses_changed_expected_config(self) -> None:
        assert self._update(expected_config={"webhook_id": 9}) is False
        assert self._update(expected_config={"webhook_id": None}) is False

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 10

    def test_none_expects_an_unset_key(self) -> None:
        assert self._update(expected_config={"missing": None}) is True

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 20

    def test_refuses_repository_in_other_organization(self) -> None:
        other_org = self.create_organization()

        assert (
            repository_service.update_repository_config(
                organization_id=other_org.id, id=self.repo.id, config_updates={"webhook_id": 20}
            )
            is False
        )

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 10


@cell_silo_test
class SerializeRepositoryTest(TestCase):
    def test_returns_repository_in_same_organization(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider="integrations:github",
        )

        result = repository_service.serialize_repository(
            organization_id=self.organization.id,
            id=repo.id,
        )

        assert result is not None
        assert result["id"] == str(repo.id)

    def test_returns_none_for_repository_in_other_organization(self) -> None:
        other_org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=other_org.id,
            name="getsentry/sentry",
            external_id="100",
            provider="integrations:github",
        )

        result = repository_service.serialize_repository(
            organization_id=self.organization.id,
            id=repo.id,
        )

        assert result is None
