from unittest.mock import MagicMock, patch

from django.urls import reverse
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.pending_deletion import build_pending_deletion_key
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.commit import Commit
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repository import Repository
from sentry.models.repositorysettings import RepositorySettings
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class OrganizationRepositoryGetTest(APITestCase):
    def test_get_repository(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example",
            organization_id=org.id,
            provider="integrations:github",
            external_id="abc123",
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["id"] == str(repo.id)
        assert response.data["name"] == "example"
        assert response.data["externalId"] == "abc123"
        assert "settings" not in response.data

    def test_get_repository_not_found(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, 99999])
        response = self.client.get(url)

        assert response.status_code == 404

    def test_get_repository_expand_settings(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example",
            organization_id=org.id,
            provider="integrations:github",
        )
        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=["on_new_commit", "on_ready_for_review"],
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.get(url, {"expand": "settings"})

        assert response.status_code == 200
        assert response.data["id"] == str(repo.id)
        assert response.data["settings"] is not None
        assert response.data["settings"]["enabledCodeReview"] is True
        assert set(response.data["settings"]["codeReviewTriggers"]) == {
            "on_new_commit",
            "on_ready_for_review",
            "on_command_phrase",
        }

    def test_get_repository_expand_settings_no_settings_exist(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example",
            organization_id=org.id,
            provider="integrations:github",
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.get(url, {"expand": "settings"})

        assert response.status_code == 200
        assert response.data["id"] == str(repo.id)
        assert response.data["settings"] is None


class OrganizationRepositoryDeleteTest(APITestCase):
    def assert_rename_pending_delete(self, response, repo, external_id=None):
        assert response.data["status"] == "pending_deletion"
        assert response.data["name"] == "example"  # name displayed matches what the user expects

        assert repo.status == ObjectStatus.PENDING_DELETION
        assert repo.name == "abc123"
        assert repo.external_id == "abc123"
        assert repo.config["pending_deletion_name"] == "example"

        option = OrganizationOption.objects.get(
            organization_id=repo.organization_id, key=build_pending_deletion_key(repo)
        )
        assert option.value == {
            "id": repo.id,
            "model": Repository.__name__,
            "name": "example",
            "external_id": external_id,
        }

    def test_delete_no_commits(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        with patch("sentry.db.pending_deletion.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository", date_scheduled__lte=timezone.now()
        ).exists()
        self.assert_rename_pending_delete(response, repo)

    def test_delete_with_commits(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, external_id="abc123"
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.pending_deletion.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository", date_scheduled__gt=timezone.now()
        ).exists()
        self.assert_rename_pending_delete(response, repo, "abc123")

    def test_delete_disabled_no_commits(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example",
            external_id="abc12345",
            organization_id=org.id,
            status=ObjectStatus.DISABLED,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.pending_deletion.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)
        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository"
        ).exists()
        self.assert_rename_pending_delete(response, repo, "abc12345")

    def test_delete_disabled_with_commits(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, status=ObjectStatus.DISABLED
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with patch("sentry.db.pending_deletion.uuid4", new=self.get_mock_uuid()):
            response = self.client.delete(url)

        assert response.status_code == 202, (response.status_code, response.content)

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.PENDING_DELETION

        assert RegionScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository"
        ).exists()
        self.assert_rename_pending_delete(response, repo)

    def test_put(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        repo = Repository.objects.create(
            name="example", organization_id=org.id, status=ObjectStatus.DISABLED
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.integration_id == integration.id

    def test_put_cancel_deletion(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        integration = self.create_integration(
            organization=org, provider="example", name="Example", external_id="example:1"
        )

        repo = Repository.objects.create(
            name="uuid-name",
            external_id="uuid-external-id",
            organization_id=org.id,
            status=ObjectStatus.PENDING_DELETION,
            config={"pending_deletion_name": "example-name"},
        )

        OrganizationOption.objects.create(
            organization_id=org.id,
            key=build_pending_deletion_key(repo),
            value={
                "name": "example-name",
                "external_id": "example-external-id",
                "id": repo.id,
                "model": Repository.__name__,
            },
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.integration_id == integration.id
        assert repo.provider == "integrations:example"
        assert repo.name == "example-name"
        assert repo.external_id == "example-external-id"
        assert repo.config == {}

        assert not OrganizationOption.objects.filter(
            organization_id=org.id, key=build_pending_deletion_key(repo)
        ).exists()

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_put_hide_repo(self, mock_cleanup_task: MagicMock) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(
            name="uuid-name",
            external_id="uuid-external-id",
            provider="github",
            organization_id=org.id,
            status=ObjectStatus.ACTIVE,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "hidden"})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN

        # Verify the cleanup task was called
        mock_cleanup_task.assert_called_once_with(
            kwargs={
                "organization_id": org.id,
                "repo_external_id": "uuid-external-id",
                "repo_provider": "github",
            }
        )

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_put_hide_repo_with_commits(self, mock_cleanup_task: MagicMock) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example", organization_id=org.id, external_id="abc123", provider="github"
        )
        Commit.objects.create(repository_id=repo.id, key="a" * 40, organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])

        with self.tasks():
            response = self.client.put(url, data={"status": "hidden"})
            assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN
        assert len(Commit.objects.filter(repository_id=repo.id)) == 0

        # Verify the cleanup task was called
        mock_cleanup_task.assert_called_once_with(
            kwargs={
                "organization_id": org.id,
                "repo_external_id": "abc123",
                "repo_provider": "github",
            }
        )

    def test_put_bad_integration_org(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(provider="example", name="example")

        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        # integration isn't linked to org
        response = self.client.put(url, data={"status": "visible", "integrationId": integration.id})

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid integration id"
        assert Repository.objects.get(id=repo.id).name == "example"

    def test_put_bad_integration_id(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        repo = Repository.objects.create(name="example", organization_id=org.id)

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        # integration isn't linked to org
        response = self.client.put(url, data={"status": "visible", "integrationId": "notanumber"})

        assert response.status_code == 400
        assert response.data == {"integrationId": ["A valid integer is required."]}
        assert Repository.objects.get(id=repo.id).name == "example"

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_put_hide_repo_triggers_cleanup(self, mock_cleanup_task: MagicMock) -> None:
        """Test that hiding a repository triggers Seer cleanup task."""
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example-repo",
            external_id="github-123",
            provider="github",
            organization_id=org.id,
            status=ObjectStatus.ACTIVE,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "hidden"})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN

        # Verify the cleanup task was called with correct parameters
        mock_cleanup_task.assert_called_once_with(
            kwargs={
                "organization_id": org.id,
                "repo_external_id": "github-123",
                "repo_provider": "github",
            }
        )

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_put_hide_repo_no_cleanup_when_null_fields(self, mock_cleanup_task: MagicMock) -> None:
        """Test that hiding a repository with null external_id/provider does not trigger Seer cleanup."""
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example-repo",
            external_id=None,  # No external_id
            provider=None,  # No provider
            organization_id=org.id,
            status=ObjectStatus.ACTIVE,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "hidden"})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN

        # Verify the cleanup task was NOT called
        mock_cleanup_task.assert_not_called()

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_put_hide_repo_no_cleanup_when_external_id_null(
        self, mock_cleanup_task: MagicMock
    ) -> None:
        """Test that hiding a repository with null external_id does not trigger Seer cleanup."""
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example-repo",
            external_id=None,  # No external_id
            provider="github",
            organization_id=org.id,
            status=ObjectStatus.ACTIVE,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "hidden"})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN

        # Verify the cleanup task was NOT called
        mock_cleanup_task.assert_not_called()

    @patch("sentry.tasks.seer.cleanup_seer_repository_preferences.apply_async")
    def test_put_hide_repo_no_cleanup_when_provider_null(
        self, mock_cleanup_task: MagicMock
    ) -> None:
        """Test that hiding a repository with null provider does not trigger Seer cleanup."""
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")
        repo = Repository.objects.create(
            name="example-repo",
            external_id="github-123",
            provider=None,  # No provider
            organization_id=org.id,
            status=ObjectStatus.ACTIVE,
        )

        url = reverse("sentry-api-0-organization-repository-details", args=[org.slug, repo.id])
        response = self.client.put(url, data={"status": "hidden"})

        assert response.status_code == 200

        repo = Repository.objects.get(id=repo.id)
        assert repo.status == ObjectStatus.HIDDEN

        # Verify the cleanup task was NOT called
        mock_cleanup_task.assert_not_called()
