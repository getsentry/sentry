import calendar
from unittest.mock import MagicMock, patch

import orjson
from django.utils import timezone

from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.promptsactivity import PromptsActivity
from sentry.models.repository import Repository
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.endpoints.group_autofix_setup_check import (
    get_autofix_integration_setup_problems,
    get_repos_and_access,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.cache import cache


class GetAutofixIntegrationSetupProblemsTestCase(TestCase):
    def test_missing_integration(self) -> None:
        result = get_autofix_integration_setup_problems(
            organization=self.organization, project=self.project
        )

        assert result == "integration_missing"

    def test_supported_github_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            external_id="1",
        )

        result = get_autofix_integration_setup_problems(
            organization=self.organization, project=self.project
        )

        assert result is None

    def test_supported_github_integration_with_disabled_status(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB.value,
            external_id="1",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.disable()

        result = get_autofix_integration_setup_problems(
            organization=self.organization, project=self.project
        )

        assert result == "integration_missing"

    def test_supported_github_enterprise_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
            external_id="1",
        )

        result = get_autofix_integration_setup_problems(
            organization=self.organization, project=self.project
        )

        assert result is None

    def test_supported_github_enterprise_integration_with_disabled_status(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
            external_id="1",
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.disable()

        result = get_autofix_integration_setup_problems(
            organization=self.organization, project=self.project
        )

        assert result == "integration_missing"

    def test_unsupported_gitlab_integration(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider=IntegrationProviderSlug.GITLAB.value,
            external_id="1",
        )

        result = get_autofix_integration_setup_problems(
            organization=self.organization, project=self.project
        )

        assert result == "integration_missing"


@with_feature("organizations:gen-ai-features")
class GroupAIAutofixEndpointSuccessTest(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        integration = self.create_integration(organization=self.organization, external_id="1")

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org_integration = integration.add_organization(self.organization, self.user)

        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
            stack_root="sentry/",
            source_root="sentry/",
        )

    def _set_seat_based_tier_cache(self, value: bool) -> None:
        """Set the cache for is_seer_seat_based_tier_enabled to return the given value."""
        cache.set(f"seer:seat-based-tier:{self.organization.id}", value)

    def _set_project_repos_cache(self, value: bool) -> None:
        """Set the cache for has_project_connected_repos to return the given value.

        Note: The setup check endpoint now uses skip_cache=True, so this only
        affects the cache that gets set after the API call, not the lookup.
        For tests that need to control the return value, use the
        @patch decorator on has_project_connected_repos instead.
        """
        cache.set(f"seer-project-has-repos:{self.organization.id}:{self.project.id}", value)

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=True,
    )
    def test_successful_setup(self, mock_has_repos: MagicMock) -> None:
        """
        Everything is set up correctly, should respond with OKs.
        """
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data == {
            "autofixEnabled": False,
            "integration": {
                "ok": True,
                "reason": None,
            },
            "githubWriteIntegration": None,
            "setupAcknowledgement": {
                "orgHasAcknowledged": False,
                "userHasAcknowledged": False,
            },
            "billing": {
                "hasAutofixQuota": True,
            },
            "seerReposLinked": True,
        }

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=True,
    )
    def test_current_user_acknowledged_setup(self, mock_has_repos: MagicMock) -> None:
        """
        Test when the current user has acknowledged the setup.
        """
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        feature = "seer_autofix_setup_acknowledged"
        PromptsActivity.objects.create(
            user_id=self.user.id,
            feature=feature,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps(
                {"dismissed_ts": calendar.timegm(timezone.now().utctimetuple())}
            ).decode("utf-8"),
        )

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["setupAcknowledgement"] == {
            "orgHasAcknowledged": True,
            "userHasAcknowledged": True,
        }

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=True,
    )
    def test_org_acknowledged_not_user(self, mock_has_repos: MagicMock) -> None:
        """
        Test when another user in the org has acknowledged, but not the requesting user.
        """
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        other_user = self.create_user()
        self.create_member(user=other_user, organization=self.organization, role="member")
        feature = "seer_autofix_setup_acknowledged"
        PromptsActivity.objects.create(
            user_id=other_user.id,
            feature=feature,
            organization_id=self.organization.id,
            project_id=0,
            data=orjson.dumps(
                {"dismissed_ts": calendar.timegm(timezone.now().utctimetuple())}
            ).decode("utf-8"),
        )

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["setupAcknowledgement"] == {
            "orgHasAcknowledged": True,
            "userHasAcknowledged": False,
        }

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=True,
    )
    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.get_repos_and_access",
        return_value=[
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
                "ok": True,
            }
        ],
    )
    def test_successful_with_write_access(
        self, mock_get_repos_and_access: MagicMock, mock_has_repos: MagicMock
    ) -> None:
        """
        Everything is set up correctly, should respond with OKs.
        """
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/?check_write_access=true"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data == {
            "autofixEnabled": False,
            "integration": {
                "ok": True,
                "reason": None,
            },
            "githubWriteIntegration": {
                "ok": True,
                "repos": [
                    {
                        "provider": "github",
                        "owner": "getsentry",
                        "name": "seer",
                        "external_id": "123",
                        "ok": True,
                    }
                ],
            },
            "setupAcknowledgement": {
                "orgHasAcknowledged": False,
                "userHasAcknowledged": False,
            },
            "billing": {
                "hasAutofixQuota": True,
            },
            "seerReposLinked": True,
        }

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=False,
    )
    def test_seer_repos_not_linked(self, mock_has_repos: MagicMock) -> None:
        """
        Test when project has no repos linked in Seer.
        """
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["seerReposLinked"] is False

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        side_effect=Exception("API error"),
    )
    def test_seer_repos_linked_defaults_to_false_on_error(self, mock_has_repos: MagicMock) -> None:
        """
        Test that seerReposLinked defaults to False when the API call fails.
        """
        self._set_seat_based_tier_cache(True)
        # Don't set project repos cache - let the actual function run and raise an exception

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["seerReposLinked"] is False

    def test_seer_repos_linked_is_false_when_feature_disabled(self) -> None:
        """
        Test that seerReposLinked is False when seat-based tier is not enabled.
        """
        self._set_seat_based_tier_cache(False)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["seerReposLinked"] is False

    def test_autofix_automation_tuning_non_seat_based(self) -> None:
        self.login_as(user=self.user)

        for setting in [None] + list(AutofixAutomationTuningSettings):
            self.project.update_option("sentry:autofix_automation_tuning", setting)
            group = self.create_group()
            url = f"/api/0/issues/{group.id}/autofix/setup/"
            response = self.client.get(url, format="json")

            assert response.status_code == 200
            assert response.data["autofixEnabled"] is False

    def test_autofix_automation_tuning_off(self) -> None:
        self._set_seat_based_tier_cache(True)
        self.login_as(user=self.user)

        for setting in [None, AutofixAutomationTuningSettings.OFF]:
            self.project.update_option("sentry:autofix_automation_tuning", setting)
            group = self.create_group()
            url = f"/api/0/issues/{group.id}/autofix/setup/"
            response = self.client.get(url, format="json")

            assert response.status_code == 200
            assert response.data["autofixEnabled"] is False

    def test_autofix_automation_tuning_on(self) -> None:
        self._set_seat_based_tier_cache(True)
        self.login_as(user=self.user)

        for setting in [
            setting
            for setting in AutofixAutomationTuningSettings
            if setting != AutofixAutomationTuningSettings.OFF
        ]:
            self.project.update_option("sentry:autofix_automation_tuning", setting)
            group = self.create_group()
            url = f"/api/0/issues/{group.id}/autofix/setup/"
            response = self.client.get(url, format="json")

            assert response.status_code == 200
            assert response.data["autofixEnabled"] is True


class GroupAIAutofixEndpointFailureTest(APITestCase, SnubaTestCase):
    def _set_seat_based_tier_cache(self, value: bool) -> None:
        """Set the cache for is_seer_seat_based_tier_enabled to return the given value."""
        cache.set(f"seer:seat-based-tier:{self.organization.id}", value)

    def test_missing_integration(self) -> None:
        self._set_seat_based_tier_cache(True)
        # Note: has_project_connected_repos is not called when integration check fails

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.organization_integration.delete()

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["integration"] == {
            "ok": False,
            "reason": "integration_missing",
        }
        # seerReposLinked should be False when integration is missing
        assert response.data["seerReposLinked"] is False

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=True,
    )
    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.get_repos_and_access",
        return_value=[
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
                "ok": False,
            },
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "sentry",
                "external_id": "234",
                "ok": True,
            },
        ],
    )
    def test_repo_write_access_not_ready(
        self, mock_get_repos_and_access: MagicMock, mock_has_repos: MagicMock
    ) -> None:
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/?check_write_access=true"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["githubWriteIntegration"] == {
            "ok": False,
            "repos": [
                {
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "seer",
                    "external_id": "123",
                    "ok": False,
                },
                {
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "234",
                    "ok": True,
                },
            ],
        }

    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.has_project_connected_repos",
        return_value=True,
    )
    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.get_repos_and_access",
        return_value=[],
    )
    def test_repo_write_access_no_repos(
        self, mock_get_repos_and_access: MagicMock, mock_has_repos: MagicMock
    ) -> None:
        self._set_seat_based_tier_cache(True)

        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/?check_write_access=true"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["githubWriteIntegration"] == {
            "ok": False,
            "repos": [],
        }

    @patch("sentry.seer.endpoints.group_autofix_setup_check.requests.post")
    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.get_autofix_repos_from_project_code_mappings",
        return_value=[
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
            }
        ],
    )
    def test_non_github_provider(self, mock_get_repos: MagicMock, mock_post: MagicMock) -> None:
        # Mock the response from the Seer service
        mock_response = mock_post.return_value
        mock_response.json.return_value = {"has_access": True}

        group = self.create_group()
        result = get_repos_and_access(self.project, group.id)

        # Verify the result
        assert result == [
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
                "ok": True,
            }
        ]

        # Verify the API call was made correctly
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert "data" in call_kwargs
        assert "headers" in call_kwargs
        assert "content-type" in call_kwargs["headers"]

    @patch("sentry.seer.endpoints.group_autofix_setup_check.requests.post")
    @patch(
        "sentry.seer.endpoints.group_autofix_setup_check.get_autofix_repos_from_project_code_mappings",
        return_value=[
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
            }
        ],
    )
    def test_repo_without_access(self, mock_get_repos: MagicMock, mock_post: MagicMock) -> None:
        # Mock the response to indicate no access
        mock_response = mock_post.return_value
        mock_response.json.return_value = {"has_access": False}

        group = self.create_group()
        result = get_repos_and_access(self.project, group.id)

        assert result == [
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
                "ok": False,
            }
        ]
