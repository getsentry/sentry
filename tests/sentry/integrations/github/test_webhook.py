from datetime import datetime, timedelta, timezone
from typing import cast
from unittest.mock import MagicMock, patch
from uuid import uuid4

import responses
from django.test import override_settings

from fixtures.github import (
    INSTALLATION_API_RESPONSE,
    INSTALLATION_DELETE_EVENT_EXAMPLE,
    INSTALLATION_EVENT_EXAMPLE,
    INSTALLATION_NEW_PERMISSIONS_EVENT_EXAMPLE,
    ISSUES_ASSIGNED_EVENT_EXAMPLE,
    ISSUES_CLOSED_EVENT_EXAMPLE,
    ISSUES_REOPENED_EVENT_EXAMPLE,
    ISSUES_UNASSIGNED_EVENT_EXAMPLE,
    PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PUSH_EVENT_EXAMPLE_INSTALLATION,
    push_event_with_author,
    push_event_with_commit_authors,
)
from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.github.webhook import (
    CheckSuiteWebhook,
    GitHubIntegrationsWebhookEndpoint,
    InstallationRepositoriesEventWebhook,
    _track_contributor_action_processor,
)
from sentry.integrations.github.webhook_types import (
    GithubWebhookType,
    InstallationRepositoriesEvent,
)
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import ExternalActorSource, ExternalProviders
from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.pr_metrics.webhooks import handle_check_suite as pr_metrics_handle_check_suite
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric, assert_success_metric
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


class WebhookTest(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def test_get(self) -> None:
        response = self.client.get(self.url)

        assert response.status_code == 405

    def test_unregistered_event(self) -> None:
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="UnregisteredEvent",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

    def test_invalid_signature_event(self) -> None:
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 401

    @patch("sentry.integrations.github.webhook.metrics")
    def test_invalid_signature_emits_hmac_failure_metric(self, mock_metrics: MagicMock) -> None:
        self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        mock_metrics.incr.assert_called_with(
            "github.webhook.hmac_failure",
            tags={"reason": "invalid_signature"},
            sample_rate=1.0,
        )

    @patch("sentry.integrations.github.webhook.metrics")
    @patch.object(GitHubIntegrationsWebhookEndpoint, "get_secret", return_value=None)
    def test_missing_secret_emits_hmac_failure_metric(
        self, mock_get_secret: MagicMock, mock_metrics: MagicMock
    ) -> None:
        self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        mock_metrics.incr.assert_called_with(
            "github.webhook.hmac_failure",
            tags={"reason": "missing_secret"},
            sample_rate=1.0,
        )

    def test_missing_signature_event(self) -> None:
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 400


class SCMOnlyWebhookTest(APITestCase):
    """Tests for webhook event types that have no legacy processors and only
    publish to the SCM event stream."""

    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def create_github_integration_and_repo(self) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            organization=self.organization,
            external_id="12345",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        self.create_repo(
            self.project,
            external_id="35129377",
            provider="integrations:github",
            integration_id=integration.id,
        )

    @patch("sentry.integrations.github.webhook.produce_event_to_scm_stream")
    @patch.object(CheckSuiteWebhook, "_handle", autospec=True)
    def test_check_suite_routes_to_handler_and_publishes_to_scm_stream(
        self, mock_handle: MagicMock, mock_produce: MagicMock
    ) -> None:
        self.create_github_integration_and_repo()

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="check_suite",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204
        # check_suite now feeds the PR-metrics activity timeline in addition to
        # being republished to the SCM stream.
        assert pr_metrics_handle_check_suite in CheckSuiteWebhook.WEBHOOK_EVENT_PROCESSORS
        mock_handle.assert_called_once()
        mock_produce.assert_called_once()


@control_silo_test
class InstallationEventWebhookTest(APITestCase):
    base_url = "https://api.github.com"

    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_installation_created(self, mock_record: MagicMock, get_jwt: MagicMock) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/app/installations/2",
            body=INSTALLATION_API_RESPONSE,
            status=200,
            content_type="application/json",
        )

        response = self.client.post(
            path=self.url,
            data=INSTALLATION_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=348e46312df2901e8cb945616ee84ce30d9987c9",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9d5801982bcabdb4df5e1680cc37a00fe495cc0ab193668ba7bbbe345451c46",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

        integration = Integration.objects.get(external_id=2)
        assert integration.external_id == "2"
        assert integration.name == "octocat"
        assert integration.metadata["sender"]["id"] == 1
        assert integration.metadata["sender"]["login"] == "octocat"
        assert integration.status == ObjectStatus.ACTIVE

        assert_success_metric(mock_record)

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github.webhook.InstallationEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_installation_error_metric(
        self, mock_record: MagicMock, mock_event: MagicMock, get_jwt: MagicMock
    ) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.github.com/app/installations/2",
            body=INSTALLATION_API_RESPONSE,
            status=200,
            content_type="application/json",
        )

        error = Exception("error")
        mock_event.side_effect = error

        response = self.client.post(
            path=self.url,
            data=INSTALLATION_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=348e46312df2901e8cb945616ee84ce30d9987c9",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9d5801982bcabdb4df5e1680cc37a00fe495cc0ab193668ba7bbbe345451c46",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 500

        assert_failure_metric(mock_record, error)


@control_silo_test
class InstallationDeleteEventWebhookTest(APITestCase):
    base_url = "https://api.github.com"

    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_installation_deleted(self, get_jwt: MagicMock) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        integration.add_organization(self.project.organization.id, self.user)
        assert integration.status == ObjectStatus.ACTIVE

        repo = self.create_repo(
            self.project,
            provider="integrations:github",
            integration_id=integration.id,
        )

        with patch.object(GithubRequestParser, "get_cells_from_organizations", return_value=[]):
            response = self.client.post(
                path=self.url,
                data=INSTALLATION_DELETE_EVENT_EXAMPLE,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="installation",
                HTTP_X_HUB_SIGNATURE="sha1=6a660af7f5c9e5dbc98e83abdff07adf40fafdf4",
                HTTP_X_HUB_SIGNATURE_256="sha256=037b8cddfa1697fecf60e1390138e11e117a04096a02a8c52c09ab808ce6555c",
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )
            assert response.status_code == 204

        integration = Integration.objects.get(external_id=2)
        assert integration.external_id == "2"
        assert integration.name == "octocat"
        assert integration.status == ObjectStatus.DISABLED

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.DISABLED

    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_installation_deleted_no_org_integration(self, get_jwt: MagicMock) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        integration.add_organization(self.project.organization.id, self.user)
        assert integration.status == ObjectStatus.ACTIVE

        # Set up condition that the OrganizationIntegration is deleted prior to the webhook event
        OrganizationIntegration.objects.filter(
            integration_id=integration.id,
            organization_id=self.project.organization.id,
        ).delete()

        response = self.client.post(
            path=self.url,
            data=INSTALLATION_DELETE_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=6a660af7f5c9e5dbc98e83abdff07adf40fafdf4",
            HTTP_X_HUB_SIGNATURE_256="sha256=037b8cddfa1697fecf60e1390138e11e117a04096a02a8c52c09ab808ce6555c",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

        integration = Integration.objects.get(external_id=2)
        assert integration.external_id == "2"
        assert integration.name == "octocat"
        assert integration.status == ObjectStatus.DISABLED


@control_silo_test
class InstallationNewPermissionsEventWebhookTest(APITestCase):
    base_url = "https://api.github.com"

    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _post(self) -> int:
        body = INSTALLATION_NEW_PERMISSIONS_EVENT_EXAMPLE
        sig1 = GitHubIntegrationsWebhookEndpoint.compute_signature(
            "sha1", body.encode(), self.secret
        )
        sig256 = GitHubIntegrationsWebhookEndpoint.compute_signature(
            "sha256", body.encode(), self.secret
        )
        response = self.client.post(
            path=self.url,
            data=body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE=f"sha1={sig1}",
            HTTP_X_HUB_SIGNATURE_256=f"sha256={sig256}",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        return response.status_code

    def _add_refresh_response(self) -> None:
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/2/access_tokens",
            json={
                "token": "new-token",
                "expires_at": "2099-01-01T00:00:00Z",
                "permissions": {"contents": "write", "pull_requests": "write"},
            },
            status=200,
            content_type="application/json",
        )

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_refreshes_token_and_persists_permissions(self, get_jwt: MagicMock) -> None:
        # A token that is still valid (well in the future) so the only reason a
        # refresh happens is that the handler expired it. Confirms we ALWAYS refresh.
        future_expires = datetime.now().replace(microsecond=0) + timedelta(hours=1)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={
                "access_token": "old-token",
                "expires_at": future_expires.isoformat(),
                "permissions": {"contents": "read"},
            },
        )
        self._add_refresh_response()

        assert self._post() == 204

        # The refresh endpoint was hit even though the stored token was unexpired.
        assert len(responses.calls) == 1
        assert "access_tokens" in responses.calls[0].request.url

        integration = Integration.objects.get(external_id="2")
        assert integration.metadata["access_token"] == "new-token"
        assert integration.metadata["expires_at"] == "2099-01-01T00:00:00"
        # Permissions returned with the refreshed token are persisted as a side effect.
        assert integration.metadata["permissions"] == {
            "contents": "write",
            "pull_requests": "write",
        }

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_missing_integration_is_noop(self, get_jwt: MagicMock) -> None:
        self._add_refresh_response()

        # No integration exists for external_id "2".
        assert self._post() == 204
        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_token_refresh_failure_is_non_fatal(self, get_jwt: MagicMock) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(hours=1)
        self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={
                "access_token": "old-token",
                "expires_at": future_expires.isoformat(),
                "permissions": {"contents": "read"},
            },
        )
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/2/access_tokens",
            status=500,
        )

        # A failed refresh must not surface an error to GitHub.
        assert self._post() == 204

        # The token was expired prior to the (failed) refresh; it stays expired so
        # the next request will retry the refresh lazily.
        integration = Integration.objects.get(external_id="2")
        assert integration.metadata["access_token"] is None
        assert integration.metadata["expires_at"] is None


@control_silo_test
class InstallationRepositoriesEventWebhookTest(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _make_event(self, action="added", repos_added=None, repos_removed=None):
        return json.dumps(
            {
                "action": action,
                "installation": {"id": 2},
                "repositories_added": repos_added or [],
                "repositories_removed": repos_removed or [],
                "repository_selection": "selected",
                "sender": {"id": 1, "login": "octocat"},
            }
        )

    def _compute_signatures(self, body: str) -> tuple[str, str]:
        sha1 = GitHubIntegrationsWebhookEndpoint.compute_signature(
            "sha1", body.encode(), self.secret
        )
        sha256 = GitHubIntegrationsWebhookEndpoint.compute_signature(
            "sha256", body.encode(), self.secret
        )
        return f"sha1={sha1}", f"sha256={sha256}"

    @patch("sentry.integrations.github.webhook.InstallationRepositoriesEventWebhook.__call__")
    def test_webhook_dispatches_to_handler(self, mock_call: MagicMock) -> None:
        """Verify the endpoint routes installation_repositories events to the correct handler."""
        body = self._make_event(
            repos_added=[{"id": 1, "full_name": "getsentry/sentry", "private": False}],
        )
        sha1, sha256 = self._compute_signatures(body)

        response = self.client.post(
            path=self.url,
            data=body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation_repositories",
            HTTP_X_HUB_SIGNATURE=sha1,
            HTTP_X_HUB_SIGNATURE_256=sha256,
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204
        assert mock_call.called

    def test_end_to_end_repos_added(self) -> None:
        """Full end-to-end: webhook URL → handler → task → Repository rows created."""
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        body = self._make_event(
            repos_added=[
                {"id": 10, "full_name": "getsentry/sentry", "private": False},
                {"id": 20, "full_name": "getsentry/snuba", "private": False},
            ],
        )
        sha1, sha256 = self._compute_signatures(body)

        with self.tasks():
            response = self.client.post(
                path=self.url,
                data=body,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="installation_repositories",
                HTTP_X_HUB_SIGNATURE=sha1,
                HTTP_X_HUB_SIGNATURE_256=sha256,
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )
        assert response.status_code == 204

        with assume_test_silo_mode(SiloMode.CELL):
            repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")

        assert len(repos) == 2
        assert repos[0].name == "getsentry/sentry"
        assert repos[0].provider == "integrations:github"
        assert repos[1].name == "getsentry/snuba"

    def test_end_to_end_repos_removed(self) -> None:
        """Full end-to-end: webhook URL → handler → task → Repository disabled."""
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="getsentry/old-repo",
                external_id="30",
                provider="integrations:github",
                integration_id=integration.id,
                status=ObjectStatus.ACTIVE,
            )

        body = self._make_event(
            action="removed",
            repos_removed=[{"id": 30, "full_name": "getsentry/old-repo", "private": False}],
        )
        sha1, sha256 = self._compute_signatures(body)

        with self.tasks():
            response = self.client.post(
                path=self.url,
                data=body,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="installation_repositories",
                HTTP_X_HUB_SIGNATURE=sha1,
                HTTP_X_HUB_SIGNATURE_256=sha256,
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )
        assert response.status_code == 204

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.DISABLED

    @patch(
        "sentry.integrations.github.tasks.sync_repos_on_install_change.sync_repos_on_install_change.apply_async"
    )
    def test_handler_dispatches_task_on_repos_added(self, mock_apply_async: MagicMock) -> None:
        """Test the handler class directly — repos_added dispatches the async task."""
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        handler = InstallationRepositoriesEventWebhook()
        handler(
            event={
                "installation": {"id": 2},
                "action": "added",
                "repositories_added": [
                    {"id": 10, "full_name": "getsentry/sentry", "private": False}
                ],
                "repositories_removed": [],
                "repository_selection": "selected",
                "sender": {"id": 1, "login": "octocat"},
            }
        )

        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["integration_id"] == integration.id
        assert kwargs["action"] == "added"
        assert len(kwargs["repos_added"]) == 1
        assert kwargs["repos_added"][0]["id"] == 10
        assert kwargs["repos_removed"] == []
        assert kwargs["repository_selection"] == "selected"

    @patch(
        "sentry.integrations.github.tasks.sync_repos_on_install_change.sync_repos_on_install_change.apply_async"
    )
    def test_handler_dispatches_task_on_repos_removed(self, mock_apply_async: MagicMock) -> None:
        """Test the handler class directly — repos_removed dispatches the async task."""
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        handler = InstallationRepositoriesEventWebhook()
        handler(
            event={
                "installation": {"id": 2},
                "action": "removed",
                "repositories_added": [],
                "repositories_removed": [
                    {"id": 20, "full_name": "getsentry/old-repo", "private": False}
                ],
                "repository_selection": "selected",
                "sender": {"id": 1, "login": "octocat"},
            }
        )

        mock_apply_async.assert_called_once()
        kwargs = mock_apply_async.call_args[1]["kwargs"]
        assert kwargs["action"] == "removed"
        assert len(kwargs["repos_removed"]) == 1

    @patch(
        "sentry.integrations.github.tasks.sync_repos_on_install_change.sync_repos_on_install_change.apply_async"
    )
    def test_handler_skips_when_no_repos(self, mock_apply_async: MagicMock) -> None:
        """No repos added or removed — task should not be dispatched."""
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        handler = InstallationRepositoriesEventWebhook()
        handler(
            event={
                "installation": {"id": 2},
                "action": "added",
                "repositories_added": [],
                "repositories_removed": [],
                "repository_selection": "selected",
                "sender": {"id": 1, "login": "octocat"},
            }
        )

        mock_apply_async.assert_not_called()

    @patch(
        "sentry.integrations.github.tasks.sync_repos_on_install_change.sync_repos_on_install_change.apply_async"
    )
    def test_handler_skips_when_malformed_event(self, mock_apply_async: MagicMock) -> None:
        """Malformed event missing required keys — handler returns early."""
        handler = InstallationRepositoriesEventWebhook()
        malformed_event = cast(
            InstallationRepositoriesEvent,
            {"repositories_added": [{"id": 1}], "repositories_removed": []},
        )
        handler(event=malformed_event)

        mock_apply_async.assert_not_called()

    @patch(
        "sentry.integrations.github.tasks.sync_repos_on_install_change.sync_repos_on_install_change.apply_async"
    )
    def test_handler_skips_when_integration_not_found(self, mock_apply_async: MagicMock) -> None:
        """Integration doesn't exist in Sentry — handler returns early."""
        handler = InstallationRepositoriesEventWebhook()
        handler(
            event={
                "installation": {"id": 99999},
                "action": "added",
                "repositories_added": [{"id": 1, "full_name": "org/repo", "private": False}],
                "repositories_removed": [],
                "repository_selection": "selected",
                "sender": {"id": 1, "login": "octocat"},
            }
        )

        mock_apply_async.assert_not_called()

    @patch(
        "sentry.integrations.github.tasks.sync_repos_on_install_change.sync_repos_on_install_change.apply_async"
    )
    def test_handler_propagates_host_for_ghe(self, mock_apply_async: MagicMock) -> None:
        """GitHub Enterprise uses host prefix for external_id."""
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="github.mycompany.com:2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        handler = InstallationRepositoriesEventWebhook()
        handler(
            event={
                "installation": {"id": 2},
                "action": "added",
                "repositories_added": [{"id": 1, "full_name": "org/repo", "private": False}],
                "repositories_removed": [],
                "repository_selection": "selected",
                "sender": {"id": 1, "login": "octocat"},
            },
            host="github.mycompany.com",
        )

        mock_apply_async.assert_called_once()


class PushEventWebhookTest(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _create_integration_and_send_push_event(self):
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_HUB_SIGNATURE_256="sha256=923b0fbedd24b106400c1dd23251972aee23dc797e0ab7cdd6d0c089db802402",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

    def _send_push_event(self, body: str):
        sig1 = GitHubIntegrationsWebhookEndpoint.compute_signature(
            "sha1", body.encode("utf-8"), self.secret
        )
        sig256 = GitHubIntegrationsWebhookEndpoint.compute_signature(
            "sha256", body.encode("utf-8"), self.secret
        )
        return self.client.post(
            path=self.url,
            data=body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE=f"sha1={sig1}",
            HTTP_X_HUB_SIGNATURE_256=f"sha256={sig256}",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

    def _setup_github_integration_and_repo(self):
        Repository.objects.create(
            organization_id=self.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.organization.id, self.user)
        return integration

    @responses.activate
    def test_creates_external_actor_for_new_commit_author(self) -> None:
        member = self.create_user(email="newdev@example.com")
        self.create_member(user=member, organization=self.organization)
        integration = self._setup_github_integration_and_repo()

        response = self._send_push_event(
            push_event_with_author(name="New Dev", email="newdev@example.com", username="newdev")
        )
        assert response.status_code == 204

        external_actors = list(ExternalActor.objects.filter(organization_id=self.organization.id))
        assert len(external_actors) == 1
        external_actor = external_actors[0]
        assert external_actor.user_id == member.id
        assert external_actor.external_name == "@newdev"
        assert external_actor.provider == ExternalProviders.GITHUB.value
        assert external_actor.integration_id == integration.id
        assert external_actor.source == ExternalActorSource.COMMIT_AUTHOR.value

    @responses.activate
    def test_skips_external_actor_for_noreply_email(self) -> None:
        member = self.create_user(email="newdev@example.com")
        self.create_member(user=member, organization=self.organization)
        self._setup_github_integration_and_repo()

        response = self._send_push_event(
            push_event_with_author(
                name="New Dev",
                email="newdev@users.noreply.github.com",
                username="newdev",
            )
        )
        assert response.status_code == 204

        assert not ExternalActor.objects.filter(organization_id=self.organization.id).exists()

    @responses.activate
    def test_skips_external_actor_when_email_does_not_match_user(self) -> None:
        self._setup_github_integration_and_repo()

        response = self._send_push_event(
            push_event_with_author(
                name="Stranger", email="stranger@example.com", username="stranger"
            )
        )
        assert response.status_code == 204

        assert not ExternalActor.objects.filter(organization_id=self.organization.id).exists()

    @responses.activate
    def test_external_actor_creation_is_idempotent(self) -> None:
        member = self.create_user(email="newdev@example.com")
        self.create_member(user=member, organization=self.organization)
        self._setup_github_integration_and_repo()

        body = push_event_with_author(name="New Dev", email="newdev@example.com", username="newdev")
        assert self._send_push_event(body).status_code == 204
        # Re-sending creates a new CommitAuthor lookup but must not duplicate the mapping.
        assert self._send_push_event(body).status_code == 204

        assert (
            ExternalActor.objects.filter(
                organization_id=self.organization.id, user_id=member.id
            ).count()
            == 1
        )

    @responses.activate
    def test_creates_external_actor_when_username_arrives_in_later_push(self) -> None:
        member = self.create_user(email="newdev@example.com")
        self.create_member(user=member, organization=self.organization)
        self._setup_github_integration_and_repo()

        # GitHub omits the username when the commit email isn't tied to a GitHub
        # account, so the first push creates the author without one.
        response = self._send_push_event(
            push_event_with_author(name="New Dev", email="newdev@example.com")
        )
        assert response.status_code == 204
        assert not ExternalActor.objects.filter(organization_id=self.organization.id).exists()

        # A later push for the same email carries the username; the reused author
        # must still gain its ExternalActor mapping.
        response = self._send_push_event(
            push_event_with_author(name="New Dev", email="newdev@example.com", username="newdev")
        )
        assert response.status_code == 204

        external_actors = list(ExternalActor.objects.filter(organization_id=self.organization.id))
        assert len(external_actors) == 1
        assert external_actors[0].user_id == member.id
        assert external_actors[0].external_name == "@newdev"

    @responses.activate
    def test_creates_external_actor_when_username_arrives_in_later_commit(self) -> None:
        member = self.create_user(email="newdev@example.com")
        self.create_member(user=member, organization=self.organization)
        self._setup_github_integration_and_repo()

        # Within a single push, the first commit lacks the username but a later
        # commit for the same email includes it.
        response = self._send_push_event(
            push_event_with_commit_authors(
                [
                    {"name": "New Dev", "email": "newdev@example.com", "username": None},
                    {"name": "New Dev", "email": "newdev@example.com", "username": "newdev"},
                ]
            )
        )
        assert response.status_code == 204

        external_actors = list(ExternalActor.objects.filter(organization_id=self.organization.id))
        assert len(external_actors) == 1
        assert external_actors[0].user_id == member.id
        assert external_actors[0].external_name == "@newdev"

    @responses.activate
    def test_does_not_duplicate_external_actor_for_casing_variant(self) -> None:
        member = self.create_user(email="newdev@example.com")
        self.create_member(user=member, organization=self.organization)
        integration = self._setup_github_integration_and_repo()

        # Pre-existing mapping uses a different casing than the webhook payload.
        existing = ExternalActor.objects.create(
            organization_id=self.organization.id,
            integration_id=integration.id,
            user_id=member.id,
            provider=ExternalProviders.GITHUB.value,
            external_name="@NewDev",
        )

        response = self._send_push_event(
            push_event_with_author(name="New Dev", email="newdev@example.com", username="newdev")
        )
        assert response.status_code == 204

        external_actors = list(
            ExternalActor.objects.filter(organization_id=self.organization.id, user_id=member.id)
        )
        assert len(external_actors) == 1
        # The original casing is preserved; no casing-variant duplicate is created.
        assert external_actors[0].id == existing.id
        assert external_actors[0].external_name == "@NewDev"

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github.webhook.PushEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_webhook_error_metric(
        self, mock_record: MagicMock, mock_event: MagicMock, get_jwt: MagicMock
    ) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        error = Exception("error")
        mock_event.side_effect = error

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_HUB_SIGNATURE_256="sha256=923b0fbedd24b106400c1dd23251972aee23dc797e0ab7cdd6d0c089db802402",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 500

        assert_failure_metric(mock_record, error)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_simple(self, mock_record: MagicMock) -> None:
        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/repo",
        )

        self._create_integration_and_send_push_event()

        commit_list = list(
            Commit.objects.filter(
                organization_id=self.project.organization.id,
            )
            .select_related("author")
            .order_by("-date_added")
        )

        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == "133d60480286590a610a0eb7352ff6e02b9674c4"
        assert commit.message == "Update hello.py"
        assert commit.author is not None
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@users.noreply.github.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author is not None
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@users.noreply.github.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

        commit_filechanges = CommitFileChange.objects.all()
        assert len(commit_filechanges) == 4

        repo.refresh_from_db()
        assert set(repo.languages) == {"python", "javascript"}
        assert repo.name == "baxterthehacker/public-repo"

        assert_success_metric(mock_record)

    @responses.activate
    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_viewer_context_set_during_handler(self, mock_record: MagicMock) -> None:
        """ViewerContext is set with org_id and actor_type=INTEGRATION during webhook processing."""
        from sentry.viewer_context import ActorType, get_viewer_context

        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/repo",
        )

        captured_contexts: list = []

        from sentry.integrations.github.webhook import PushEventWebhook

        original_handle = PushEventWebhook._handle

        def capturing_handle(self_handler, **kwargs):
            captured_contexts.append(get_viewer_context())
            return original_handle(self_handler, **kwargs)

        with patch.object(PushEventWebhook, "_handle", capturing_handle):
            self._create_integration_and_send_push_event()

        assert len(captured_contexts) == 1
        ctx = captured_contexts[0]
        assert ctx is not None
        assert ctx.organization_id == self.project.organization.id
        assert ctx.actor_type == ActorType.INTEGRATION
        assert ctx.user_id is None

    @responses.activate
    @patch("sentry.integrations.github.webhook.metrics")
    def test_creates_missing_repo(self, mock_metrics: MagicMock) -> None:
        self._create_integration_and_send_push_event()

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0].organization_id == self.project.organization.id
        assert repos[0].external_id == "35129377"
        assert repos[0].provider == "integrations:github"
        assert repos[0].name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    def test_ignores_hidden_repo(self) -> None:
        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        repo.status = ObjectStatus.HIDDEN
        repo.external_id = "35129377"
        repo.save()

        self._create_integration_and_send_push_event()

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0] == repo

    def test_anonymous_lookup(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        CommitAuthor.objects.create(
            external_id="github:baxterthehacker",
            organization_id=self.project.organization.id,
            email="baxterthehacker@example.com",
            name="bàxterthehacker",
        )

        self._create_integration_and_send_push_event()

        commit_list = list(
            Commit.objects.filter(organization_id=self.project.organization.id)
            .select_related("author")
            .order_by("-date_added")
        )

        # should be skipping the #skipsentry commit
        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == "133d60480286590a610a0eb7352ff6e02b9674c4"
        assert commit.message == "Update hello.py"
        assert commit.author is not None
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author is not None
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

        commit_filechanges = CommitFileChange.objects.all()
        assert len(commit_filechanges) == 4

        repo.refresh_from_db()
        assert set(repo.languages) == {"python", "javascript"}

    @responses.activate
    def test_multiple_orgs(self) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        self.create_integration(
            organization=self.organization,
            external_id="12345",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )

        org2 = self.create_organization()
        project2 = self.create_project(organization=org2, name="bar")

        self.create_repo(
            project=project2,
            provider="integrations:github",
            name="another/repo",
        )

        integration = self.create_integration(
            organization=self.organization,
            external_id="99",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.add_organization(org2.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_HUB_SIGNATURE_256="sha256=923b0fbedd24b106400c1dd23251972aee23dc797e0ab7cdd6d0c089db802402",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=self.project.organization.id)
            .select_related("author")
            .order_by("-date_added")
        )

        assert len(commit_list) == 2

        commit_list = list(
            Commit.objects.filter(organization_id=org2.id)
            .select_related("author")
            .order_by("-date_added")
        )
        assert len(commit_list) == 0

    @responses.activate
    @patch("sentry.integrations.github.webhook.metrics")
    def test_multiple_orgs_creates_missing_repos(self, mock_metrics: MagicMock) -> None:
        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            organization=self.organization,
            external_id="12345",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.add_organization(org2.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_HUB_SIGNATURE_256="sha256=923b0fbedd24b106400c1dd23251972aee23dc797e0ab7cdd6d0c089db802402",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 2

        assert {self.project.organization.id, org2.id} == {repo.organization_id for repo in repos}
        for repo in repos:
            assert repo.external_id == "35129377"
            assert repo.provider == "integrations:github"
            assert repo.name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    def test_multiple_orgs_ignores_hidden_repo(self) -> None:
        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)
            integration.add_organization(org2.id, self.user)

        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        repo.external_id = "35129377"
        repo.status = ObjectStatus.HIDDEN
        repo.save()

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_HUB_SIGNATURE_256="sha256=923b0fbedd24b106400c1dd23251972aee23dc797e0ab7cdd6d0c089db802402",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0] == repo


class PullRequestEventWebhookTest(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _get_signature_sha1(self, body: bytes | str) -> str:
        if isinstance(body, str):
            body = body.encode("utf-8")
        sig = GitHubIntegrationsWebhookEndpoint.compute_signature("sha1", body, self.secret)
        return f"sha1={sig}"

    def _get_signature_sha256(self, body: bytes | str) -> str:
        if isinstance(body, str):
            body = body.encode("utf-8")
        sig = GitHubIntegrationsWebhookEndpoint.compute_signature("sha256", body, self.secret)
        return f"sha256={sig}"

    def _post_pull_request_event(self, body: bytes) -> None:
        response = self.client.post(
            path=self.url,
            data=body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE=self._get_signature_sha1(body),
            HTTP_X_HUB_SIGNATURE_256=self._get_signature_sha256(body),
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

    def _create_integration_and_send_pull_request_opened_event(self):
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=6ab37f1f7c8b4f0c223d1c346855fc2ac47ee749",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9f96076ede4be8eaf808e78c891287617af9d2292b7359c3dc3d063c3e356b8",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204
        return integration

    @patch("sentry.integrations.github.webhook.PullRequestEventWebhook.__call__")
    def test_github_delivery_id_extracted_and_passed_to_processors(
        self, mock_handler: MagicMock
    ) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            ).add_organization(self.project.organization.id, self.user)

        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        body = PULL_REQUEST_OPENED_EVENT_EXAMPLE
        delivery_id = "test-delivery-id-abc123"

        response = self.client.post(
            path=self.url,
            data=body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE=self._get_signature_sha1(body),
            HTTP_X_HUB_SIGNATURE_256=self._get_signature_sha256(body),
            HTTP_X_GITHUB_DELIVERY=delivery_id,
        )

        assert response.status_code == 204
        mock_handler.assert_called_once()
        call_kwargs = mock_handler.call_args[1]
        assert call_kwargs["github_delivery_id"] == delivery_id

    @patch("sentry.integrations.github.webhook.PullRequestEventWebhook.__call__")
    def test_github_delivery_id_missing_passed_as_none(self, mock_handler: MagicMock) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            ).add_organization(self.project.organization.id, self.user)

        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        body = PULL_REQUEST_OPENED_EVENT_EXAMPLE

        response = self.client.post(
            path=self.url,
            data=body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE=self._get_signature_sha1(body),
            HTTP_X_HUB_SIGNATURE_256=self._get_signature_sha256(body),
            # Omit HTTP_X_GITHUB_DELIVERY so request.META.get returns None
        )

        assert response.status_code == 204
        mock_handler.assert_called_once()
        call_kwargs = mock_handler.call_args[1]
        assert call_kwargs["github_delivery_id"] is None

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github.webhook.PullRequestEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_webhook_error_metric(
        self, mock_record: MagicMock, mock_event: MagicMock, get_jwt: MagicMock
    ) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        error = Exception("error")
        mock_event.side_effect = error

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=6ab37f1f7c8b4f0c223d1c346855fc2ac47ee749",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9f96076ede4be8eaf808e78c891287617af9d2292b7359c3dc3d063c3e356b8",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 500

        assert_failure_metric(mock_record, error)

    @patch("sentry.integrations.source_code_management.commit_context.metrics")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_opened(
        self,
        mock_record: MagicMock,
        mock_metrics: MagicMock,
    ) -> None:
        group = self.create_group(project=self.project, short_id=7)
        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        self._create_integration_and_send_pull_request_opened_event()

        prs = PullRequest.objects.filter(
            repository_id=repo.id, organization_id=self.project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert (
            pr.message
            == "This is a pretty simple change that we need to pull into master. Fixes BAR-7"
        )
        assert pr.title == "Update the README with new information"
        assert pr.author is not None
        assert pr.author.name == "baxterthehacker"

        # Emit-sourced facts persisted for the PR metrics pipeline.
        assert pr.head_commit_sha == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert pr.state == PullRequestLifecycleState.OPEN
        assert pr.opened_at == datetime(2015, 5, 5, 23, 40, 27, tzinfo=timezone.utc)
        assert pr.closed_at is None
        assert pr.merged_at is None
        # The opened fixture omits the draft flag.
        assert pr.draft is None

        self.assert_group_link(group, pr)

        assert_success_metric(mock_record)

    @patch("sentry.integrations.github.webhook.metrics")
    def test_creates_missing_repo(self, mock_metrics: MagicMock) -> None:
        self._create_integration_and_send_pull_request_opened_event()

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0].organization_id == self.project.organization.id
        assert repos[0].external_id == "35129377"
        assert repos[0].provider == "integrations:github"
        assert repos[0].name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_any_call("github.webhook.repository_created")

    def test_ignores_hidden_repo(self) -> None:
        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        repo.status = ObjectStatus.HIDDEN
        repo.external_id = "35129377"
        repo.save()

        self._create_integration_and_send_pull_request_opened_event()

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0] == repo

    @patch("sentry.integrations.github.webhook.metrics")
    def test_multiple_orgs_creates_missing_repo(self, mock_metrics: MagicMock) -> None:
        project = self.project  # force creation

        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=project.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(org2.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=6ab37f1f7c8b4f0c223d1c346855fc2ac47ee749",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9f96076ede4be8eaf808e78c891287617af9d2292b7359c3dc3d063c3e356b8",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()

        assert len(repos) == 2

        assert {repo.organization_id for repo in repos} == {project.organization.id, org2.id}

        for repo in repos:
            assert repo.external_id == "35129377"
            assert repo.provider == "integrations:github"
            assert repo.name == "baxterthehacker/public-repo"

        mock_metrics.incr.assert_any_call("github.webhook.repository_created")

    def test_multiple_orgs_ignores_hidden_repo(self) -> None:
        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)
            integration.add_organization(org2.id, self.user)

        repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        repo.external_id = "35129377"
        repo.status = ObjectStatus.HIDDEN
        repo.save()

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=6ab37f1f7c8b4f0c223d1c346855fc2ac47ee749",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9f96076ede4be8eaf808e78c891287617af9d2292b7359c3dc3d063c3e356b8",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0] == repo

    def test_edited_pr_description_with_group_link(self) -> None:
        group = self.create_group(project=self.project, short_id=7)
        url = "/extensions/github/webhook/"
        secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", secret)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        pr = PullRequest.objects.create(
            key="1", repository_id=repo.id, organization_id=self.project.organization.id
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_EDITED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=fb6c68217745a610c101a904d6ac37cf224d1ff7",
            HTTP_X_HUB_SIGNATURE_256="sha256=5e4486adcf1478f5ff1981b1dbadf3a3124aa340af6344f27db274261a816b9d",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        pr = PullRequest.objects.get(id=pr.id)

        assert pr.key == "1"
        assert pr.message == "new edited body. Fixes BAR-7"
        assert pr.title == "new edited title"
        assert pr.author is not None
        assert pr.author.name == "baxterthehacker"

        self.assert_group_link(group, pr)

    def test_ready_for_review_updates_draft_on_existing_row(self) -> None:
        # A PR opened as a draft and later marked ready: the second webhook must
        # refresh draft on the existing row (update_or_create updates defaults,
        # it doesn't only create), not leave the stale draft=True or fork a row.
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        opened = json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        opened["pull_request"]["draft"] = True
        self._post_pull_request_event(json.dumps(opened).encode())

        pr = PullRequest.objects.get(
            repository_id=repo.id, organization_id=self.project.organization.id, key="1"
        )
        assert pr.draft is True
        assert pr.state == PullRequestLifecycleState.OPEN

        ready = json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        ready["action"] = "ready_for_review"
        ready["pull_request"]["draft"] = False
        self._post_pull_request_event(json.dumps(ready).encode())

        # Re-fetch (not refresh_from_db) so the row is read fresh.
        pr = PullRequest.objects.get(
            repository_id=repo.id, organization_id=self.project.organization.id, key="1"
        )
        assert pr.draft is False
        # Same row updated, not a duplicate.
        assert (
            PullRequest.objects.filter(
                repository_id=repo.id, organization_id=self.project.organization.id
            ).count()
            == 1
        )

    @patch("sentry.integrations.github.webhook.metrics")
    def test_closed(self, mock_metrics: MagicMock) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)

        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
            integration_id=integration.id,
        )

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=f5473aab0c319a06023e6569c028203e872a2f6c",
            HTTP_X_HUB_SIGNATURE_256="sha256=521aebffd5a0a81f572cdcdea69c7062cacb09ff5f821123d5fd7d2f7f0f87ef",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=repo.id, organization_id=self.project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert pr.message == "new closed body"
        assert pr.title == "new closed title"
        assert pr.author is not None
        assert pr.author.name == "baxterthehacker"
        assert pr.merge_commit_sha == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"

        # Emit-sourced facts persisted for the PR metrics pipeline. The payload's
        # merged flag wins over its (open) state, so the PR is "merged".
        assert pr.head_commit_sha == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert pr.state == PullRequestLifecycleState.MERGED
        assert pr.opened_at == datetime(2015, 5, 5, 23, 40, 27, tzinfo=timezone.utc)
        assert pr.closed_at == datetime(2015, 5, 5, 23, 40, 27, tzinfo=timezone.utc)
        assert pr.merged_at == datetime(2015, 5, 5, 23, 40, 27, tzinfo=timezone.utc)
        assert pr.draft is None

        assert mock_metrics.incr.call_count == 1

    def assert_group_link(self, group, pr):
        link = GroupLink.objects.get()
        assert link.group_id == group.id
        assert link.linked_id == pr.id
        assert link.linked_type == GroupLink.LinkedType.pull_request

    @patch("sentry.integrations.github.webhook.track_contributor_seat")
    def test_pull_request_calls_track_contributor_seat(
        self,
        mock_track_contributor_seat: MagicMock,
    ) -> None:
        repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        integration = self._create_integration_and_send_pull_request_opened_event()

        mock_track_contributor_seat.assert_called_once()
        call_kwargs = mock_track_contributor_seat.call_args[1]
        assert call_kwargs["integration_id"] == integration.id
        assert str(call_kwargs["user_id"]) == "6752317"
        assert call_kwargs["user_username"] == "baxterthehacker"
        assert call_kwargs["provider"] == "github"
        assert call_kwargs["organization"] == self.project.organization
        assert call_kwargs["repo"] == repo


class IssuesEventWebhookTest(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(self.project.organization.id, self.user)
        self.integration = integration

    @patch("sentry.integrations.github.webhook.sync_group_assignee_inbound_by_external_actor")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assigned_issue(self, mock_record: MagicMock, mock_sync: MagicMock) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=self.url,
            data=ISSUES_ASSIGNED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="issues",
            HTTP_X_HUB_SIGNATURE="sha1=75deab06ede0068fe16b5f1f6ee1a9509738e006",
            HTTP_X_HUB_SIGNATURE_256="sha256=1703af48011c6709662f776163fce1e86772eff189f94e1ebff5ad66a81b711e",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        rpc_integration = integration_service.get_integration(integration_id=self.integration.id)

        mock_sync.assert_called_once_with(
            integration=rpc_integration,
            external_user_name="@octocat",
            external_issue_key="baxterthehacker/public-repo#2",
            assign=True,
        )

        assert_success_metric(mock_record)

    @patch("sentry.integrations.github.webhook.sync_group_assignee_inbound_by_external_actor")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unassigned_issue(self, mock_record: MagicMock, mock_sync: MagicMock) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=self.url,
            data=ISSUES_UNASSIGNED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="issues",
            HTTP_X_HUB_SIGNATURE="sha1=8d2cf8bdfaae30fc619bfbfafee3681404a12d6b",
            HTTP_X_HUB_SIGNATURE_256="sha256=19794c8575c58d0be5d447e08b50d7cc235e7f7e76b32a0c371988d4335fab21",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        rpc_integration = integration_service.get_integration(integration_id=self.integration.id)

        # With the fix, we now use issue.assignees (current state) instead of assignee (delta)
        # ISSUES_UNASSIGNED_EVENT_EXAMPLE has assignees=[], so we deassign
        mock_sync.assert_called_once_with(
            integration=rpc_integration,
            external_user_name="",
            external_issue_key="baxterthehacker/public-repo#2",
            assign=False,
        )

        assert_success_metric(mock_record)

    def test_missing_assignee_data(self) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        event_data = json.loads(ISSUES_ASSIGNED_EVENT_EXAMPLE)
        del event_data["assignee"]

        response = self.client.post(
            path=self.url,
            data=json.dumps(event_data),
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="issues",
            HTTP_X_HUB_SIGNATURE="sha1=fake",
            HTTP_X_HUB_SIGNATURE_256="sha256=fake",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        # Should fail due to invalid signature
        assert response.status_code == 401

    @patch("sentry.integrations.github.webhook.metrics")
    def test_creates_missing_repo_for_issues(self, mock_metrics: MagicMock) -> None:
        response = self.client.post(
            path=self.url,
            data=ISSUES_ASSIGNED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="issues",
            HTTP_X_HUB_SIGNATURE="sha1=75deab06ede0068fe16b5f1f6ee1a9509738e006",
            HTTP_X_HUB_SIGNATURE_256="sha256=1703af48011c6709662f776163fce1e86772eff189f94e1ebff5ad66a81b711e",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0].organization_id == self.project.organization.id
        assert repos[0].external_id == "35129377"
        assert repos[0].provider == "integrations:github"
        assert repos[0].name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_closed_issue(self, mock_record: MagicMock) -> None:
        self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="baxterthehacker/public-repo#2",
        )

        with patch(
            "sentry.integrations.github.integration.GitHubIntegration.sync_status_inbound"
        ) as mock_sync:
            response = self.client.post(
                path=self.url,
                data=ISSUES_CLOSED_EVENT_EXAMPLE,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="issues",
                HTTP_X_HUB_SIGNATURE="sha1=069543293765b5bec93645252813c0254b213edd",
                HTTP_X_HUB_SIGNATURE_256="sha256=9be56955f00d995f3a8b339f62c4d2f270ba25fd169db3d08150bdc82fa914b8",
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )

            assert response.status_code == 204
            mock_sync.assert_called_once()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_reopened_issue(self, mock_record: MagicMock) -> None:
        self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="baxterthehacker/public-repo#2",
        )

        with patch(
            "sentry.integrations.github.integration.GitHubIntegration.sync_status_inbound"
        ) as mock_sync:
            response = self.client.post(
                path=self.url,
                data=ISSUES_REOPENED_EVENT_EXAMPLE,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="issues",
                HTTP_X_HUB_SIGNATURE="sha1=1c1dd45d6ddff6bbc004ea19decca29e6bd98a8b",
                HTTP_X_HUB_SIGNATURE_256="sha256=888724cc9396caf181628f81bcda5c4a29e2e9575fdf951505371090ec142ad3",
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )

            assert response.status_code == 204
            mock_sync.assert_called_once()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_closed_issue_multiple_orgs(self, mock_record: MagicMock) -> None:
        """Test that closed issues sync to all organization integrations"""
        # Create second organization
        org2 = self.create_organization(owner=self.user)
        self.create_project(organization=org2)

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(org2.id, self.user)

        # Create repos for both orgs
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        Repository.objects.create(
            organization_id=org2.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        # Create linked issues for both orgs
        self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="baxterthehacker/public-repo#2",
        )

        with patch(
            "sentry.integrations.github.integration.GitHubIntegration.sync_status_inbound"
        ) as mock_sync:
            response = self.client.post(
                path=self.url,
                data=ISSUES_CLOSED_EVENT_EXAMPLE,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="issues",
                HTTP_X_HUB_SIGNATURE="sha1=069543293765b5bec93645252813c0254b213edd",
                HTTP_X_HUB_SIGNATURE_256="sha256=9be56955f00d995f3a8b339f62c4d2f270ba25fd169db3d08150bdc82fa914b8",
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )

            assert response.status_code == 204
            # Sync should be called for each org that has a linked issue
            assert mock_sync.call_count >= 1

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_reopened_issue_multiple_orgs(self, mock_record: MagicMock) -> None:
        """Test that reopened issues sync to all organization integrations"""
        # Create second organization
        org2 = self.create_organization(owner=self.user)
        self.create_project(organization=org2)

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(org2.id, self.user)

        # Create repos for both orgs
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        Repository.objects.create(
            organization_id=org2.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        # Create linked issues for both orgs
        self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="baxterthehacker/public-repo#2",
        )

        with patch(
            "sentry.integrations.github.integration.GitHubIntegration.sync_status_inbound"
        ) as mock_sync:
            response = self.client.post(
                path=self.url,
                data=ISSUES_REOPENED_EVENT_EXAMPLE,
                content_type="application/json",
                HTTP_X_GITHUB_EVENT="issues",
                HTTP_X_HUB_SIGNATURE="sha1=1c1dd45d6ddff6bbc004ea19decca29e6bd98a8b",
                HTTP_X_HUB_SIGNATURE_256="sha256=888724cc9396caf181628f81bcda5c4a29e2e9575fdf951505371090ec142ad3",
                HTTP_X_GITHUB_DELIVERY=str(uuid4()),
            )

            assert response.status_code == 204
            # Sync should be called for each org that has a linked issue
            assert mock_sync.call_count >= 1


class TrackContributorActionProcessorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", integration_id=self.integration.id
        )
        self.rpc_integration = integration_service.get_integration(
            integration_id=self.integration.id
        )

    @patch("sentry.integrations.github.webhook.record_contributor_action")
    def test_success(self, mock_record: MagicMock) -> None:
        _track_contributor_action_processor(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE),
            organization=self.organization,
            repo=self.repo,
            integration=self.rpc_integration,
        )

        mock_record.assert_called_once()
        kwargs = mock_record.call_args.kwargs
        assert kwargs["organization"].id == self.organization.id
        assert kwargs["repo"].id == self.repo.id
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["user_id"] == "6752317"
        assert kwargs["user_username"] == "baxterthehacker"
        assert kwargs["provider"] == "github"
        assert kwargs["pr_number"] == 1
        assert kwargs["is_opened"] is True
        assert kwargs["logs_extra"] == {"github_event_action": "opened"}
        assert kwargs["tags"] == {"is_private": False}

    @patch("sentry.integrations.github.webhook.record_contributor_action")
    def test_is_opened_false_for_non_opened_action(self, mock_record: MagicMock) -> None:
        event = json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        event["action"] = "synchronize"
        _track_contributor_action_processor(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration=self.rpc_integration,
        )

        assert mock_record.call_args.kwargs["is_opened"] is False

    @patch("sentry.integrations.github.webhook.record_contributor_action")
    def test_no_integration_skips(self, mock_record: MagicMock) -> None:
        _track_contributor_action_processor(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE),
            organization=self.organization,
            repo=self.repo,
            integration=None,
        )

        mock_record.assert_not_called()

    @patch("sentry.integrations.github.webhook.record_contributor_action")
    def test_missing_pull_request_skips(self, mock_record: MagicMock) -> None:
        event = json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        del event["pull_request"]
        _track_contributor_action_processor(
            github_event=GithubWebhookType.PULL_REQUEST,
            event=event,
            organization=self.organization,
            repo=self.repo,
            integration=self.rpc_integration,
        )

        mock_record.assert_not_called()
