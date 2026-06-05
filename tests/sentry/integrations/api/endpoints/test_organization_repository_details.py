from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.pending_deletion import build_pending_deletion_key
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.models.commit import Commit
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


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
        self.create_repository_settings(
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
        assert response.data["settings"]["codeReviewTriggers"] == [
            "on_new_commit",
            "on_ready_for_review",
        ]

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
        # Settings are auto-created for GitHub repos with org defaults
        assert response.data["settings"] is not None
        assert response.data["settings"]["enabledCodeReview"] is False
        assert response.data["settings"]["codeReviewTriggers"] == [
            "on_ready_for_review",
        ]


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

        assert CellScheduledDeletion.objects.filter(
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
        assert CellScheduledDeletion.objects.filter(
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

        assert CellScheduledDeletion.objects.filter(
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

        assert CellScheduledDeletion.objects.filter(
            object_id=repo.id, model_name="Repository"
        ).exists()
        self.assert_rename_pending_delete(response, repo)
