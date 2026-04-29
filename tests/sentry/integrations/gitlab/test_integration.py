from __future__ import annotations

from typing import Any
from unittest.mock import Mock, patch

import orjson
import pytest
import responses
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from fixtures.gitlab import GET_COMMIT_RESPONSE, GitLabTestCase
from sentry.integrations.gitlab.client import GitLabApiClient, GitLabSetupApiClient
from sentry.integrations.gitlab.constants import GITLAB_WEBHOOK_VERSION, GITLAB_WEBHOOK_VERSION_KEY
from sentry.integrations.gitlab.integration import GitlabIntegration, GitlabIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.shared_integrations.exceptions import (
    ApiForbiddenError,
    IntegrationConfigurationError,
    IntegrationError,
)
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import json
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response


def assert_proxy_request(request, is_proxy=True):
    assert (PROXY_BASE_PATH in request.url) == is_proxy
    assert (PROXY_OI_HEADER in request.headers) == is_proxy
    assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
    # The following Gitlab headers don't appear in proxied requests
    assert ("Authorization" in request.headers) != is_proxy
    if is_proxy:
        assert request.headers[PROXY_OI_HEADER] is not None


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class GitlabSetupApiClientTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider
    base_url = "https://gitlab.example.com"
    access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
    default_group_id = 4

    @responses.activate
    def test_integration_proxy_is_active(self) -> None:
        response_payload = {
            "id": self.default_group_id,
            "full_name": "Cool",
            "full_path": "cool-group",
            "web_url": "https://gitlab.example.com/groups/cool-group",
            "avatar_url": "https://gitlab.example.com/uploads/group/avatar/4/foo.jpg",
        }
        responses.add(
            responses.GET,
            "https://gitlab.example.com/api/v4/groups/cool-group",
            json=response_payload,
        )

        responses.add(
            responses.GET,
            "http://controlserver/api/0/internal/integration-proxy/api/v4/groups/cool-group",
            json=response_payload,
        )

        class GitLabSetupTestClient(GitLabSetupApiClient):
            _use_proxy_url_for_tests = True

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = GitLabSetupTestClient(
                base_url=self.base_url,
                access_token=self.access_token,
                verify_ssl=False,
            )
            client.get_group(group="cool-group")
            request = responses.calls[0].request

            assert "https://gitlab.example.com/api/v4/groups/cool-group" == request.url
            assert client.base_url in request.url
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = GitLabSetupTestClient(
                base_url=self.base_url,
                access_token=self.access_token,
                verify_ssl=False,
            )
            client.get_group(group="cool-group")
            request = responses.calls[0].request

            assert "https://gitlab.example.com/api/v4/groups/cool-group" == request.url
            assert client.base_url in request.url
            assert_proxy_request(request, is_proxy=False)


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class GitlabApiClientTest(GitLabTestCase):
    @responses.activate
    def test_integration_proxy_is_active(self) -> None:
        gitlab_id = 123
        commit = "a" * 40
        gitlab_response = responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{gitlab_id}/repository/commits/{commit}",
            json=orjson.loads(GET_COMMIT_RESPONSE),
        )

        control_proxy_response = add_control_silo_proxy_response(
            method=responses.GET,
            path=f"api/v4/projects/{gitlab_id}/repository/commits/{commit}",
            json=orjson.loads(GET_COMMIT_RESPONSE),
        )

        class GitLabApiTestClient(GitLabApiClient):
            _use_proxy_url_for_tests = True

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = GitLabApiTestClient(self.installation)
            client.get_commit(gitlab_id, commit)
            request = responses.calls[0].request

            assert (
                f"https://example.gitlab.com/api/v4/projects/{gitlab_id}/repository/commits/{commit}"
                == request.url
            )
            assert client.base_url in request.url
            assert gitlab_response.call_count == 1
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        cache.clear()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = GitLabApiTestClient(self.installation)
            client.get_commit(gitlab_id, commit)
            request = responses.calls[0].request

            assert (
                f"https://example.gitlab.com/api/v4/projects/{gitlab_id}/repository/commits/{commit}"
                == request.url
            )
            assert client.base_url in request.url
            assert gitlab_response.call_count == 2
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        cache.clear()
        with override_settings(SILO_MODE=SiloMode.CELL):
            client = GitLabApiTestClient(self.installation)
            client.get_commit(gitlab_id, commit)
            request = responses.calls[0].request

            assert control_proxy_response.call_count == 1
            assert client.base_url not in request.url
            assert_proxy_request(request, is_proxy=True)


@control_silo_test
class GitlabIssueSyncTest(GitLabTestCase):
    def _setup_assignee_sync_test(
        self,
        user_email: str = "foo@example.com",
        external_name: str = "@gitlab_user",
        external_id: str = "123",
        issue_key: str = "example.gitlab.com/group-x:cool-group/sentry#45",
        create_external_user: bool = True,
    ) -> tuple:
        """
        Common setup for assignee sync tests.

        Returns:
            tuple: (user, installation, external_issue, integration, group)
        """

        user = serialize_rpc_user(self.create_user(email=user_email))
        integration = Integration.objects.get(provider=self.provider)

        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        group = self.create_group()

        if create_external_user:
            self.create_external_user(
                user=user,
                organization=self.organization,
                integration=integration,
                provider=ExternalProviders.GITLAB.value,
                external_name=external_name,
                external_id=external_id,
            )

        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key=issue_key,
        )

        return user, installation, external_issue, integration, group

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_get_organization_config(self) -> None:
        """Test that organization config fields are returned correctly"""

        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        fields = installation.get_organization_config()

        assert [field["name"] for field in fields] == [
            "sync_status_forward",
            "sync_reverse_assignment",
            "sync_forward_assignment",
            "sync_comments",
            "sync_status_reverse",
            "resolution_strategy",
            "pr_comments",
        ]
        # pr_comments must not be gated behind integrations-issue-sync.
        pr_field = next(f for f in fields if f["name"] == "pr_comments")
        assert "disabled" not in pr_field

    @responses.activate
    def test_update_organization_config(self) -> None:
        """Test updating organization config saves to org_integration"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Initial config should be empty
        assert org_integration.config == {}

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            # Update configuration
            data = {"sync_reverse_assignment": True, "other_option": "test_value"}
            installation.update_organization_config(data)

        # Refresh from database
        org_integration.refresh_from_db()

        # Check that config was updated
        assert org_integration.config["sync_reverse_assignment"] is True
        assert org_integration.config["other_option"] == "test_value"

    @responses.activate
    def test_update_organization_config_preserves_existing(self) -> None:
        """Test that updating org config preserves existing keys"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        org_integration.config = {
            "existing_key": "existing_value",
            "sync_reverse_assignment": False,
        }
        org_integration.save()

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            # Update configuration with new data
            data = {"sync_reverse_assignment": True, "new_key": "new_value"}
            installation.update_organization_config(data)

        org_integration.refresh_from_db()

        # Check that config was updated and existing keys preserved
        assert org_integration.config["existing_key"] == "existing_value"
        assert org_integration.config["sync_reverse_assignment"] is True
        assert org_integration.config["new_key"] == "new_value"

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_assignee_outbound(self) -> None:
        """Test assigning a GitLab issue to a user with linked GitLab account"""
        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        # Mock user search endpoint
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/users?username=gitlab_user",
            json=[{"id": 123, "username": "gitlab_user", "name": "GitLab User"}],
            status=200,
        )

        # Mock issue update endpoint
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"assignees": [{"id": 123}]},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 2
        # First call searches for user
        assert "users?username=gitlab_user" in responses.calls[0].request.url
        # Second call updates issue
        request = responses.calls[1].request
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == request.url
        )
        assert orjson.loads(request.body) == {"assignee_ids": [123]}

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_assignee_outbound_strips_at_symbol(self) -> None:
        """Test that @ symbol is stripped from external_name when syncing"""
        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        # Mock user search endpoint - note the username without @
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/users?username=gitlab_user",
            json=[{"id": 123, "username": "gitlab_user", "name": "GitLab User"}],
            status=200,
        )

        # Mock issue update endpoint
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"assignees": [{"id": 123}]},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 2
        # Verify @ was stripped in user search
        assert "users?username=gitlab_user" in responses.calls[0].request.url
        assert "@" not in responses.calls[0].request.url

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_assignee_outbound_unassign(self) -> None:
        """Test unassigning a GitLab issue"""
        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        # Mock issue update endpoint
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"assignees": []},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=False)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == request.url
        )
        assert orjson.loads(request.body) == {"assignee_ids": []}

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_assignee_outbound_no_external_actor(self) -> None:
        """Test that sync fails gracefully when user has no GitLab account linked"""
        user, installation, external_issue, _, _ = self._setup_assignee_sync_test(
            create_external_user=False
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        # Should not make any API calls
        assert len(responses.calls) == 0

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_assignee_outbound_invalid_key_format(self) -> None:
        """Test that sync handles invalid external issue key format gracefully"""
        user, installation, external_issue, _, _ = self._setup_assignee_sync_test(
            issue_key="invalid-key-format"
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        # Should not make any API calls
        assert len(responses.calls) == 0

    @responses.activate
    def test_sync_assignee_outbound_with_none_user(self) -> None:
        """Test that assigning with no user unassigns the issue"""
        integration = Integration.objects.get(provider=self.provider)

        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        group = self.create_group()

        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example.gitlab.com/group-x:cool-group/sentry#45",
        )

        # Mock issue update endpoint - when user is None, it unassigns
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"assignees": []},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, None, assign=True)

        # Should make API call to unassign when user is None
        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == request.url
        )
        assert orjson.loads(request.body) == {"assignee_ids": []}

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_assignee_outbound_user_not_found(self) -> None:
        """Test that sync handles case when GitLab user is not found"""
        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        # Mock user search endpoint returning empty list
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/users?username=gitlab_user",
            json=[],
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        # Should only call user search, not issue update
        assert len(responses.calls) == 1
        assert "users?username=gitlab_user" in responses.calls[0].request.url

    def test_create_comment(self) -> None:
        """Test creating a comment on a GitLab issue"""
        self.user.name = "Sentry Admin"
        self.user.save()
        installation = self.installation

        group_note = Mock()
        comment = "hello world\nThis is a comment.\n\n\n    Glad it's quoted"
        group_note.data = {"text": comment}

        with patch.object(
            installation.get_client().__class__, "create_comment"
        ) as mock_create_comment:
            installation.create_comment(
                "example.gitlab.com/group-x:cool-group/sentry#123", self.user.id, group_note
            )
            # The project_id will be URL-encoded by create_comment
            assert mock_create_comment.call_args[0][0] == "cool-group%2Fsentry"
            assert mock_create_comment.call_args[0][1] == "123"
            assert mock_create_comment.call_args[0][2] == {
                "body": "**Sentry Admin** wrote:\n\n> hello world\n> This is a comment.\n> \n> \n>     Glad it's quoted"
            }

    def test_split_external_issue_key_invalid(self) -> None:
        """Test splitting an invalid external issue key"""
        installation = self.installation

        project_id, issue_iid = installation.split_external_issue_key("invalid-key-format")

        assert project_id is None
        assert issue_iid is None

    def test_create_comment_attribution(self) -> None:
        """Test comment attribution formatting"""
        self.user.name = "Test User"
        self.user.save()
        installation = self.installation

        comment_text = "This is a comment\nWith multiple lines"
        result = installation.create_comment_attribution(self.user.id, comment_text)

        assert result == "**Test User** wrote:\n\n> This is a comment\n> With multiple lines"

    def test_get_repositories_unauthorized_raises_integration_configuration_error(self) -> None:
        installation = self.installation

        with patch.object(installation, "get_client") as mock_get_client:
            mock_get_client.return_value.search_projects.side_effect = ApiForbiddenError(
                text=json.dumps({"message": "unauthorized"})
            )
            with pytest.raises(IntegrationConfigurationError) as exception_info:
                installation.get_repositories()
        assert (
            str(exception_info.value) == "Error Communicating with GitLab (HTTP 403): unauthorized"
        )

    @responses.activate
    def test_update_organization_config_triggers_webhook_update_on_outdated_version(self) -> None:
        """Test that updating org config triggers webhook update when version is outdated"""

        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None

        # Set webhook version to outdated
        org_integration = integration_service.update_organization_integration(
            org_integration_id=org_integration.id,
            config={GITLAB_WEBHOOK_VERSION_KEY: 0},
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ) as mock_schedule_webhooks:
            # Update configuration
            data = {"sync_reverse_assignment": True}
            installation.update_organization_config(data)

            # Verify task was called with correct arguments
            mock_schedule_webhooks.assert_called_once_with(
                organization_id=self.organization.id,
                integration_id=integration.id,
            )

        # Verify config was updated (but version stays at 0 since task was mocked)
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None
        assert org_integration.config["sync_reverse_assignment"] is True
        # Version is still 0 because the task was mocked and didn't actually run
        assert org_integration.config[GITLAB_WEBHOOK_VERSION_KEY] == 0

    @responses.activate
    def test_update_organization_config_does_not_trigger_webhook_update_on_current_version(
        self,
    ) -> None:
        """Test that updating org config does not trigger webhook update when version is current"""

        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None

        # Set webhook version to current
        org_integration = integration_service.update_organization_integration(
            org_integration_id=org_integration.id,
            config={GITLAB_WEBHOOK_VERSION_KEY: GITLAB_WEBHOOK_VERSION},
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ) as mock_schedule_webhooks:
            # Update configuration
            data = {"sync_reverse_assignment": True}
            installation.update_organization_config(data)

            # Verify task was NOT called
            mock_schedule_webhooks.assert_not_called()

        # Verify config was still updated
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None
        assert org_integration.config["sync_reverse_assignment"] is True

    @responses.activate
    def test_update_organization_config_triggers_webhook_update_on_missing_version(
        self,
    ) -> None:
        """Test that updating org config triggers webhook update when version is missing"""

        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None

        # Ensure webhook version is not set (simulating old installations)
        config = org_integration.config
        if GITLAB_WEBHOOK_VERSION_KEY in config:
            del config[GITLAB_WEBHOOK_VERSION_KEY]
        org_integration = integration_service.update_organization_integration(
            org_integration_id=org_integration.id,
            config=config,
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ) as mock_schedule_webhooks:
            # Update configuration
            data = {"sync_comments": True}
            installation.update_organization_config(data)

            # Verify task was called
            mock_schedule_webhooks.assert_called_once_with(
                organization_id=self.organization.id,
                integration_id=integration.id,
            )

        # Verify config was updated (but version is not set since task was mocked)
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None
        assert org_integration.config["sync_comments"] is True
        # Version is not set because the task was mocked and didn't actually run
        assert GITLAB_WEBHOOK_VERSION_KEY not in org_integration.config

    @responses.activate
    def test_update_organization_config_triggers_task_when_version_missing(self) -> None:
        """Test that updating org config triggers task when webhook version is missing"""

        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        # Ensure version is not set
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None
        config = org_integration.config
        config.pop(GITLAB_WEBHOOK_VERSION_KEY, None)
        integration_service.update_organization_integration(
            org_integration_id=org_integration.id,
            config=config,
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ) as mock_schedule_webhooks:
            # Update configuration
            data = {"sync_reverse_assignment": False, "sync_comments": False}
            installation.update_organization_config(data)

            # Task should be called since version is missing (defaults to 0)
            mock_schedule_webhooks.assert_called_once_with(
                organization_id=self.organization.id,
                integration_id=integration.id,
            )

    @responses.activate
    def test_update_organization_config_preserves_other_config_values(self) -> None:
        """Test that updating org config preserves other configuration values"""

        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None

        # Set some existing config
        org_integration = integration_service.update_organization_integration(
            org_integration_id=org_integration.id,
            config={
                "existing_key": "existing_value",
                "sync_forward_assignment": True,
                GITLAB_WEBHOOK_VERSION_KEY: 0,
            },
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            # Update configuration
            data = {"sync_comments": True}
            installation.update_organization_config(data)

        # Verify all config values are preserved
        org_integration = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert org_integration is not None
        assert org_integration.config["existing_key"] == "existing_value"
        assert org_integration.config["sync_forward_assignment"] is True
        assert org_integration.config["sync_comments"] is True

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_update_organization_config_status_sync(self) -> None:
        """Test that status sync configuration creates IntegrationExternalProject records"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # No external projects initially
        assert (
            IntegrationExternalProject.objects.filter(
                organization_integration_id=org_integration.id
            ).count()
            == 0
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            # Configure status sync for two projects
            data = {
                "sync_status_forward": {
                    "my-group/project-1": {"on_resolve": "closed", "on_unresolve": "opened"},
                    "my-group/project-2": {"on_resolve": "closed", "on_unresolve": "opened"},
                }
            }
            installation.update_organization_config(data)

        # Verify IntegrationExternalProject records were created
        external_projects = IntegrationExternalProject.objects.filter(
            organization_integration_id=org_integration.id
        )
        assert external_projects.count() == 2

        project1 = external_projects.get(external_id="my-group/project-1")
        assert project1.name == "my-group/project-1"
        assert project1.resolved_status == "closed"
        assert project1.unresolved_status == "opened"

        project2 = external_projects.get(external_id="my-group/project-2")
        assert project2.name == "my-group/project-2"
        assert project2.resolved_status == "closed"
        assert project2.unresolved_status == "opened"

        # Verify the boolean flag is set
        org_integration.refresh_from_db()
        assert org_integration.config["sync_status_forward"] is True

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_update_organization_config_invalid_status(self) -> None:
        """Test that invalid status values raise IntegrationError"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            # Try to configure with invalid status
            data = {
                "sync_status_forward": {
                    "my-group/project": {"on_resolve": "invalid_status", "on_unresolve": "opened"}
                }
            }

            with pytest.raises(IntegrationError) as exc_info:
                installation.update_organization_config(data)

            assert "Invalid resolve status" in str(exc_info.value)
            assert "invalid_status" in str(exc_info.value)

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_update_organization_config_missing_status(self) -> None:
        """Test that missing on_resolve/on_unresolve raises IntegrationError"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            # Try to configure with missing on_unresolve
            data = {"sync_status_forward": {"my-group/project": {"on_resolve": "closed"}}}

            with pytest.raises(IntegrationError) as exc_info:
                installation.update_organization_config(data)

            assert "Resolve and unresolve status are required" in str(exc_info.value)

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_get_config_data_returns_status_mappings(self) -> None:
        """Test that get_config_data returns status mappings correctly"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Create some IntegrationExternalProject records
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="my-group/project-1",
            name="my-group/project-1",
            resolved_status="closed",
            unresolved_status="opened",
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="my-group/project-2",
            name="my-group/project-2",
            resolved_status="closed",
            unresolved_status="opened",
        )

        # Get config data
        config_data = installation.get_config_data()

        # Verify status mappings are returned
        assert "sync_status_forward" in config_data
        mappings = config_data["sync_status_forward"]
        assert len(mappings) == 2
        assert mappings["my-group/project-1"] == {"on_resolve": "closed", "on_unresolve": "opened"}
        assert mappings["my-group/project-2"] == {"on_resolve": "closed", "on_unresolve": "opened"}

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_status_outbound_resolve(self) -> None:
        """Test resolving a Sentry issue closes the GitLab issue"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Create IntegrationExternalProject for status mapping
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="cool-group/sentry",
            name="cool-group/sentry",
            resolved_status="closed",
            unresolved_status="opened",
        )

        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example.gitlab.com/group-x:cool-group/sentry#45",
        )

        # Mock get issue endpoint to return current state
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"iid": 45, "state": "opened", "title": "Test Issue"},
            status=200,
        )

        # Mock update issue status endpoint
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"iid": 45, "state": "closed", "title": "Test Issue"},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_status_outbound(external_issue, is_resolved=True, project_id=1)

        assert len(responses.calls) == 2
        # First call gets current state
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == responses.calls[0].request.url
        )
        # Second call updates state
        request = responses.calls[1].request
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == request.url
        )
        assert orjson.loads(request.body) == {"state_event": "close"}

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_status_outbound_unresolve(self) -> None:
        """Test unresolving a Sentry issue reopens the GitLab issue"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Create IntegrationExternalProject for status mapping
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="cool-group/sentry",
            name="cool-group/sentry",
            resolved_status="closed",
            unresolved_status="opened",
        )

        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example.gitlab.com/group-x:cool-group/sentry#45",
        )

        # Mock get issue endpoint to return current state
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"iid": 45, "state": "closed", "title": "Test Issue"},
            status=200,
        )

        # Mock update issue status endpoint
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"iid": 45, "state": "opened", "title": "Test Issue"},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_status_outbound(external_issue, is_resolved=False, project_id=1)

        assert len(responses.calls) == 2
        # First call gets current state
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == responses.calls[0].request.url
        )
        # Second call updates state
        request = responses.calls[1].request
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == request.url
        )
        assert orjson.loads(request.body) == {"state_event": "reopen"}

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_status_outbound_no_mapping(self) -> None:
        """Test that sync returns early if no IntegrationExternalProject exists"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example.gitlab.com/group-x:cool-group/sentry#45",
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_status_outbound(external_issue, is_resolved=True, project_id=1)

        # Should not make any API calls
        assert len(responses.calls) == 0

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_status_outbound_already_in_state(self) -> None:
        """Test that sync skips update if GitLab issue is already in desired state"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Create IntegrationExternalProject for status mapping
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="cool-group/sentry",
            name="cool-group/sentry",
            resolved_status="closed",
            unresolved_status="opened",
        )

        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example.gitlab.com/group-x:cool-group/sentry#45",
        )

        # Mock get issue endpoint to return state already closed
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"iid": 45, "state": "closed", "title": "Test Issue"},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_status_outbound(external_issue, is_resolved=True, project_id=1)

        # Should only call GET, not PUT since already in correct state
        assert len(responses.calls) == 1
        assert (
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45"
            == responses.calls[0].request.url
        )
        assert responses.calls[0].request.method == "GET"

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_status_outbound_invalid_key(self) -> None:
        """Test that sync handles malformed external issue keys gracefully"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="invalid-key-format",
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_status_outbound(external_issue, is_resolved=True, project_id=1)

        # Should not make any API calls
        assert len(responses.calls) == 0

    @responses.activate
    @with_feature("organizations:integrations-gitlab-project-management")
    def test_sync_status_outbound_api_error(self) -> None:
        """Test that sync handles API errors gracefully"""
        integration = Integration.objects.get(provider=self.provider)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Create IntegrationExternalProject for status mapping
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="cool-group/sentry",
            name="cool-group/sentry",
            resolved_status="closed",
            unresolved_status="opened",
        )

        group = self.create_group()
        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="example.gitlab.com/group-x:cool-group/sentry#45",
        )

        # Mock get issue endpoint to return error
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/cool-group%2Fsentry/issues/45",
            json={"message": "404 Not Found"},
            status=404,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
            with pytest.raises(IntegrationError):
                installation.sync_status_outbound(external_issue, is_resolved=True, project_id=1)


@control_silo_test
class GitLabIntegrationApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    gitlab_url = "https://gitlab.example.com"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.client_id = "app-id-abc123"
        self.client_secret = "secret-xyz789"

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "gitlab"},
            format="json",
        )

    def _get_step_info(self) -> Any:
        return self.client.get(self._get_pipeline_url())

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _stub_gitlab_oauth(self) -> None:
        responses.add(
            responses.POST,
            f"{self.gitlab_url}/oauth/token",
            json={
                "access_token": "test-access-token",
                "token_type": "bearer",
                "refresh_token": "test-refresh-token",
                "created_at": 1536798907,
                "scope": "api",
            },
        )

    def _stub_gitlab_user(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitlab_url}/api/v4/user",
            json={
                "id": 42,
                "username": "testuser",
                "email": "test@example.com",
                "name": "Test User",
            },
        )

    def _stub_gitlab_group(self) -> None:
        responses.add(
            responses.GET,
            f"{self.gitlab_url}/api/v4/groups/my-group",
            json={
                "id": 1,
                "full_name": "My Group",
                "full_path": "my-group",
                "avatar_url": "https://gitlab.example.com/avatar.png",
                "web_url": "https://gitlab.example.com/my-group",
            },
        )

    def _submit_config(self, **overrides: Any) -> Any:
        data = {
            "url": self.gitlab_url,
            "group": "my-group",
            "includeSubgroups": False,
            "verifySsl": True,
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
        }
        data.update(overrides)
        return self._advance_step(data)

    def _get_pipeline_signature(self, resp: Any) -> str:
        return resp.data["data"]["oauthUrl"].split("state=")[1].split("&")[0]

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_config"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 2
        assert resp.data["provider"] == "gitlab"

    @responses.activate
    def test_config_step_data(self) -> None:
        resp = self._initialize_pipeline()
        data = resp.data["data"]
        defaults = data["defaults"]
        assert defaults["verifySsl"] is True
        assert defaults["includeSubgroups"] is False
        setup_values = data["setupValues"]
        labels = [v["label"] for v in setup_values]
        assert "Name" in labels
        assert "Redirect URI" in labels
        assert "Scopes" in labels

    @responses.activate
    def test_config_step_validation_missing_required_fields(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"url": self.gitlab_url})
        assert resp.status_code == 400
        assert resp.data["clientId"] == ["This field is required."]
        assert resp.data["clientSecret"] == ["This field is required."]

    @responses.activate
    def test_config_step_advance_to_oauth(self) -> None:
        self._initialize_pipeline()
        resp = self._submit_config()
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "oauth_login"
        assert resp.data["stepIndex"] == 1
        assert "oauthUrl" in resp.data["data"]
        oauth_url = resp.data["data"]["oauthUrl"]
        assert self.gitlab_url in oauth_url
        assert "client_id=" in oauth_url

    @responses.activate
    def test_oauth_step_invalid_state(self) -> None:
        self._initialize_pipeline()
        self._submit_config()
        resp = self._advance_step({"code": "abc123", "state": "wrong-state"})
        assert resp.status_code == 400
        assert resp.data["status"] == "error"

    @responses.activate
    def test_oauth_step_missing_code(self) -> None:
        self._initialize_pipeline()
        self._submit_config()
        resp = self._advance_step({})
        assert resp.status_code == 400
        assert resp.data["code"] == ["This field is required."]
        assert resp.data["state"] == ["This field is required."]

    @responses.activate
    def test_full_pipeline_flow(self) -> None:
        self._stub_gitlab_oauth()
        self._stub_gitlab_user()
        self._stub_gitlab_group()

        resp = self._initialize_pipeline()
        assert resp.data["step"] == "installation_config"

        resp = self._submit_config()
        assert resp.data["step"] == "oauth_login"
        pipeline_signature = self._get_pipeline_signature(resp)

        resp = self._advance_step({"code": "gitlab-auth-code", "state": pipeline_signature})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"
        assert "data" in resp.data

        integration = Integration.objects.get(provider="gitlab")
        assert integration.metadata["base_url"] == self.gitlab_url
        assert integration.metadata["group_id"] == 1

        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
        ).exists()

    @responses.activate
    def test_full_pipeline_flow_no_group(self) -> None:
        self._stub_gitlab_oauth()
        self._stub_gitlab_user()

        self._initialize_pipeline()
        resp = self._submit_config(group="")
        pipeline_signature = self._get_pipeline_signature(resp)

        resp = self._advance_step({"code": "gitlab-auth-code", "state": pipeline_signature})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="gitlab")
        assert integration.metadata["group_id"] is None
        assert integration.metadata["include_subgroups"] is False

    @responses.activate
    def test_config_strips_trailing_slash(self) -> None:
        self._stub_gitlab_oauth()
        self._stub_gitlab_user()
        self._stub_gitlab_group()

        self._initialize_pipeline()
        resp = self._submit_config(url=f"{self.gitlab_url}///")
        assert resp.data["status"] == "advance"
        oauth_url = resp.data["data"]["oauthUrl"]
        assert "gitlab.example.com/oauth/authorize" in oauth_url
        assert "///" not in oauth_url
