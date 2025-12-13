from django.urls import reverse

from sentry.integrations.api.endpoints.organization_repository_settings import (
    _get_code_review_triggers_value,
    _get_enabled_code_review_value,
)
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger, RepositorySettings
from sentry.testutils.cases import APITestCase, TestCase


class GetEnabledCodeReviewValueTest(TestCase):
    def test_default(self) -> None:
        result = _get_enabled_code_review_value(None, None)
        assert result is False

    def test_updated_value(self) -> None:
        result = _get_enabled_code_review_value(True, None)
        assert result is True

        result = _get_enabled_code_review_value(False, None)
        assert result is False

    def test_existing_setting(self) -> None:
        result = _get_enabled_code_review_value(None, RepositorySettings(enabled_code_review=True))
        assert result is True

        result = _get_enabled_code_review_value(None, RepositorySettings(enabled_code_review=False))
        assert result is False

    def test_mixed(self):
        result = _get_enabled_code_review_value(True, RepositorySettings(enabled_code_review=False))
        assert result is True

        result = _get_enabled_code_review_value(False, RepositorySettings(enabled_code_review=True))
        assert result is False


class GetCodeReviewTriggersValueTest(TestCase):
    def test_default(self) -> None:
        result = _get_code_review_triggers_value(None, None)
        assert result == []

    def test_updated_value(self) -> None:
        result = _get_code_review_triggers_value(["on_new_commit", "on_ready_for_review"], None)
        assert result == ["on_new_commit", "on_ready_for_review"]

    def test_existing_setting(self) -> None:
        result = _get_code_review_triggers_value(
            None, RepositorySettings(code_review_triggers=["on_new_commit", "on_ready_for_review"])
        )
        assert result == ["on_new_commit", "on_ready_for_review"]

    def test_empty_updated_value(self) -> None:
        result = _get_code_review_triggers_value([], None)
        assert result == []

    def test_empty_existing_setting(self) -> None:
        result = _get_code_review_triggers_value(None, RepositorySettings(code_review_triggers=[]))
        assert result == []

    def test_mixed(self):
        result = _get_code_review_triggers_value(
            ["on_new_commit", "on_ready_for_review"],
            RepositorySettings(code_review_triggers=["on_command_phrase"]),
        )
        assert result == ["on_new_commit", "on_ready_for_review"]


class OrganizationRepositorySettingsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="test-org")
        self.url = reverse("sentry-api-0-organization-repository-settings", args=[self.org.slug])
        self.login_as(user=self.user)

    def test_bulk_create_settings(self) -> None:
        repo1 = Repository.objects.create(name="repo1", organization_id=self.org.id)
        repo2 = Repository.objects.create(name="repo2", organization_id=self.org.id)

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo1.id, repo2.id],
                "enabledCodeReview": True,
                "codeReviewTriggers": [
                    CodeReviewTrigger.ON_NEW_COMMIT,
                    CodeReviewTrigger.ON_READY_FOR_REVIEW,
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        settings1 = RepositorySettings.objects.get(repository=repo1)
        assert settings1.enabled_code_review is True
        assert settings1.code_review_triggers == ["on_new_commit", "on_ready_for_review"]

        settings2 = RepositorySettings.objects.get(repository=repo2)
        assert settings2.enabled_code_review is True
        assert settings2.code_review_triggers == ["on_new_commit", "on_ready_for_review"]

        for repo_data in response.data:
            assert "settings" in repo_data
            assert repo_data["settings"]["enabledCodeReview"] is True

    def test_bulk_update_existing_settings(self) -> None:
        repo1 = Repository.objects.create(name="repo1", organization_id=self.org.id)
        repo2 = Repository.objects.create(name="repo2", organization_id=self.org.id)

        self.create_repository_settings(
            repository=repo1,
            enabled_code_review=False,
            code_review_triggers=[CodeReviewTrigger.ON_COMMAND_PHRASE],
        )
        self.create_repository_settings(
            repository=repo2,
            enabled_code_review=False,
            code_review_triggers=[],
        )

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo1.id, repo2.id],
                "enabledCodeReview": True,
                "codeReviewTriggers": [CodeReviewTrigger.ON_NEW_COMMIT],
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        settings1 = RepositorySettings.objects.get(repository=repo1)
        assert settings1.enabled_code_review is True
        assert settings1.code_review_triggers == ["on_new_commit"]

        settings2 = RepositorySettings.objects.get(repository=repo2)
        assert settings2.enabled_code_review is True
        assert settings2.code_review_triggers == ["on_new_commit"]

    def test_repository_not_found(self) -> None:
        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [99999],
                "enabledCodeReview": False,
                "codeReviewTriggers": [],
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert "not found" in response.data["detail"]

    def test_repository_in_different_org(self) -> None:
        other_org = self.create_organization(name="other-org")
        other_repo = Repository.objects.create(name="other-repo", organization_id=other_org.id)

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [other_repo.id],
                "enabledCodeReview": False,
                "codeReviewTriggers": [],
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert "not found" in response.data["detail"]

    def test_invalid_trigger(self) -> None:
        repo = Repository.objects.create(name="repo", organization_id=self.org.id)

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo.id],
                "enabledCodeReview": True,
                "codeReviewTriggers": ["invalid_trigger"],
            },
            format="json",
        )

        assert response.status_code == 400, response.content

    def test_missing_required_fields(self) -> None:
        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [1],
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert (
            "At least one of 'enabledCodeReview' or 'codeReviewTriggers' must be provided."
            in response.data["non_field_errors"]
        )

    def test_partial_repository_ids_not_found(self) -> None:
        repo = Repository.objects.create(name="repo", organization_id=self.org.id)

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo.id, 99999],
                "enabledCodeReview": False,
                "codeReviewTriggers": [],
            },
            format="json",
        )

        assert response.status_code == 400, response.content
        assert "not found" in response.data["detail"]

    def test_partial_bulk_update_enabled_code_review_preserves_triggers(self) -> None:
        repo1 = Repository.objects.create(name="repo1", organization_id=self.org.id)
        repo2 = Repository.objects.create(name="repo2", organization_id=self.org.id)

        self.create_repository_settings(
            repository=repo1,
            enabled_code_review=False,
            code_review_triggers=[
                CodeReviewTrigger.ON_COMMAND_PHRASE,
                CodeReviewTrigger.ON_NEW_COMMIT,
            ],
        )
        self.create_repository_settings(
            repository=repo2,
            enabled_code_review=False,
            code_review_triggers=[],
        )

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo1.id, repo2.id],
                "enabledCodeReview": True,
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        settings1 = RepositorySettings.objects.get(repository=repo1)
        assert settings1.enabled_code_review is True
        assert settings1.code_review_triggers == ["on_command_phrase", "on_new_commit"]

        settings2 = RepositorySettings.objects.get(repository=repo2)
        assert settings2.enabled_code_review is True
        assert settings2.code_review_triggers == []

    def test_partial_bulk_update_code_review_triggers_preserves_enabled(self) -> None:
        repo1 = Repository.objects.create(name="repo1", organization_id=self.org.id)
        repo2 = Repository.objects.create(name="repo2", organization_id=self.org.id)

        self.create_repository_settings(
            repository=repo1,
            enabled_code_review=True,
            code_review_triggers=[CodeReviewTrigger.ON_COMMAND_PHRASE],
        )
        self.create_repository_settings(
            repository=repo2,
            enabled_code_review=False,
            code_review_triggers=[],
        )

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo1.id, repo2.id],
                "codeReviewTriggers": [
                    CodeReviewTrigger.ON_NEW_COMMIT,
                    CodeReviewTrigger.ON_READY_FOR_REVIEW,
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        settings1 = RepositorySettings.objects.get(repository=repo1)
        assert settings1.enabled_code_review is True
        assert settings1.code_review_triggers == ["on_new_commit", "on_ready_for_review"]

        settings2 = RepositorySettings.objects.get(repository=repo2)
        assert settings2.enabled_code_review is False
        assert settings2.code_review_triggers == ["on_new_commit", "on_ready_for_review"]

    def test_partial_bulk_create_enabled_code_review_uses_default(self) -> None:
        repo1 = Repository.objects.create(name="repo1", organization_id=self.org.id)
        repo2 = Repository.objects.create(name="repo2", organization_id=self.org.id)

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo1.id, repo2.id],
                "enabledCodeReview": True,
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        settings1 = RepositorySettings.objects.get(repository=repo1)
        assert settings1.enabled_code_review is True
        assert settings1.code_review_triggers == []

        settings2 = RepositorySettings.objects.get(repository=repo2)
        assert settings2.enabled_code_review is True
        assert settings2.code_review_triggers == []

    def test_partial_bulk_create_code_review_triggers_uses_default(self) -> None:
        repo1 = Repository.objects.create(name="repo1", organization_id=self.org.id)
        repo2 = Repository.objects.create(name="repo2", organization_id=self.org.id)

        response = self.client.put(
            self.url,
            data={
                "repositoryIds": [repo1.id, repo2.id],
                "codeReviewTriggers": [
                    CodeReviewTrigger.ON_NEW_COMMIT,
                    CodeReviewTrigger.ON_READY_FOR_REVIEW,
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        settings1 = RepositorySettings.objects.get(repository=repo1)
        assert settings1.enabled_code_review is False
        assert settings1.code_review_triggers == ["on_new_commit", "on_ready_for_review"]

        settings2 = RepositorySettings.objects.get(repository=repo2)
        assert settings2.enabled_code_review is False
        assert settings2.code_review_triggers == ["on_new_commit", "on_ready_for_review"]
