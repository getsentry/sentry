import calendar
from unittest.mock import patch

import orjson
from django.utils import timezone

from sentry.api.endpoints.group_autofix_setup_check import get_repos_and_access
from sentry.models.promptsactivity import PromptsActivity
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import assume_test_silo_mode


@apply_feature_flag_on_cls("organizations:gen-ai-features")
class GroupAIAutofixEndpointSuccessTest(APITestCase, SnubaTestCase):
    def setUp(self):
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

    def test_successful_setup(self):
        """
        Everything is set up correctly, should respond with OKs.
        """
        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data == {
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
        }

    def test_current_user_acknowledged_setup(self):
        """
        Test when the current user has acknowledged the setup.
        """
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

    def test_org_acknowledged_not_user(self):
        """
        Test when another user in the org has acknowledged, but not the requesting user.
        """
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
        "sentry.api.endpoints.group_autofix_setup_check.get_repos_and_access",
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
    def test_successful_with_write_access(self, mock_get_repos_and_access):
        """
        Everything is set up correctly, should respond with OKs.
        """
        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/?check_write_access=true"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data == {
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
        }


class GroupAIAutofixEndpointFailureTest(APITestCase, SnubaTestCase):
    def test_missing_integration(self):
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

    @patch(
        "sentry.api.endpoints.group_autofix_setup_check.get_repos_and_access",
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
    def test_repo_write_access_not_ready(self, mock_get_repos_and_access):
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
        "sentry.api.endpoints.group_autofix_setup_check.get_repos_and_access",
        return_value=[],
    )
    def test_repo_write_access_no_repos(self, mock_get_repos_and_access):
        group = self.create_group()
        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/autofix/setup/?check_write_access=true"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["githubWriteIntegration"] == {
            "ok": False,
            "repos": [],
        }

    @patch("sentry.api.endpoints.group_autofix_setup_check.requests.post")
    @patch(
        "sentry.api.endpoints.group_autofix_setup_check.get_autofix_repos_from_project_code_mappings",
        return_value=[
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
            }
        ],
    )
    def test_non_github_provider(self, mock_get_repos, mock_post):
        # Mock the response from the Seer service
        mock_response = mock_post.return_value
        mock_response.json.return_value = {"has_access": True}

        result = get_repos_and_access(self.project)

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

    @patch("sentry.api.endpoints.group_autofix_setup_check.requests.post")
    @patch(
        "sentry.api.endpoints.group_autofix_setup_check.get_autofix_repos_from_project_code_mappings",
        return_value=[
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
            }
        ],
    )
    def test_repo_without_access(self, mock_get_repos, mock_post):
        # Mock the response to indicate no access
        mock_response = mock_post.return_value
        mock_response.json.return_value = {"has_access": False}

        result = get_repos_and_access(self.project)

        assert result == [
            {
                "provider": "github",
                "owner": "getsentry",
                "name": "seer",
                "external_id": "123",
                "ok": False,
            }
        ]
