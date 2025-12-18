import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import responses

from fixtures.github import (
    INSTALLATION_API_RESPONSE,
    INSTALLATION_DELETE_EVENT_EXAMPLE,
    INSTALLATION_EVENT_EXAMPLE,
    ISSUES_ASSIGNED_EVENT_EXAMPLE,
    ISSUES_CLOSED_EVENT_EXAMPLE,
    ISSUES_REOPENED_EVENT_EXAMPLE,
    ISSUES_UNASSIGNED_EVENT_EXAMPLE,
    PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PUSH_EVENT_EXAMPLE_INSTALLATION,
)
from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.github.webhook import is_contributor_eligible_for_seat_assignment
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.grouplink import GroupLink
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric, assert_success_metric
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


class IsContributorEligibleForSeatAssignmentTest(TestCase):
    def test_user_is_eligible(self):
        assert is_contributor_eligible_for_seat_assignment("User")

    def test_bot_is_not_eligible(self):
        assert not is_contributor_eligible_for_seat_assignment("Bot")

    def test_user_with_none_type_is_eligible(self):
        assert is_contributor_eligible_for_seat_assignment(None)


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

    def test_missing_signature_event(self) -> None:
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 400


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

        with patch.object(GithubRequestParser, "get_regions_from_organizations", return_value=[]):
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

        with assume_test_silo_mode(SiloMode.REGION):
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

    @patch(
        "sentry.integrations.github.tasks.codecov_account_unlink.codecov_account_unlink.apply_async"
    )
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @override_options(
        {
            "github-app.id": "123",
            "github-app.webhook-secret": "b3002c3e321d4b7880360d397db2ccfd",
            "hybrid_cloud.authentication.disabled_organization_shards": [],
            "hybrid_cloud.authentication.disabled_user_shards": [],
        }
    )
    def test_installation_deleted_triggers_codecov_unlink_when_app_ids_match(
        self, get_jwt: MagicMock, mock_codecov_unlink: MagicMock
    ) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        integration.add_organization(self.project.organization.id, self.user)

        with patch.object(GithubRequestParser, "get_regions_from_organizations", return_value=[]):
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

        mock_codecov_unlink.assert_called_once_with(
            kwargs={
                "integration_id": integration.id,
                "organization_ids": [self.organization.id],
            }
        )

    @patch(
        "sentry.integrations.github.tasks.codecov_account_unlink.codecov_account_unlink.apply_async"
    )
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @override_options(
        {
            "github-app.id": "different_app_id",
            "github-app.webhook-secret": "b3002c3e321d4b7880360d397db2ccfd",
            "hybrid_cloud.authentication.disabled_organization_shards": [],
            "hybrid_cloud.authentication.disabled_user_shards": [],
        }
    )
    def test_installation_deleted_skips_codecov_unlink_when_app_ids_dont_match(
        self, get_jwt: MagicMock, mock_codecov_unlink: MagicMock
    ) -> None:
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        integration = self.create_integration(
            name="octocat",
            organization=self.organization,
            external_id="2",
            provider="github",
            metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
        )
        integration.add_organization(self.project.organization.id, self.user)

        with patch.object(GithubRequestParser, "get_regions_from_organizations", return_value=[]):
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

        mock_codecov_unlink.assert_not_called()


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


class PullRequestEventWebhook(APITestCase):
    def setUp(self) -> None:
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _get_signature_sha1(self, body: bytes) -> str:
        signature = hmac.new(
            key=self.secret.encode("utf-8"),
            msg=body,
            digestmod=hashlib.sha1,
        ).hexdigest()
        return f"sha1={signature}"

    def _get_signature_sha256(self, body: bytes) -> str:
        signature = hmac.new(
            key=self.secret.encode("utf-8"),
            msg=body,
            digestmod=hashlib.sha256,
        ).hexdigest()
        return f"sha256={signature}"

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

        assert mock_metrics.incr.call_count == 1

    def assert_group_link(self, group, pr):
        link = GroupLink.objects.get()
        assert link.group_id == group.id
        assert link.linked_id == pr.id
        assert link.linked_type == GroupLink.LinkedType.pull_request

    @patch("sentry.integrations.github.webhook.assign_seat_to_organization_contributor")
    @patch(
        "sentry.integrations.github.webhook.should_create_or_increment_contributor_seat",
        return_value=False,
    )
    def test_no_contributor_tracking_when_feature_disabled(
        self,
        mock_should_create_or_increment_contributor_seat: MagicMock,
        mock_assign_seat: MagicMock,
    ) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        integration = self._create_integration_and_send_pull_request_opened_event()

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_identifier="6752317",
        )
        assert contributor.num_actions == 0
        mock_assign_seat.delay.assert_not_called()

    @patch("sentry.integrations.github.webhook.assign_seat_to_organization_contributor")
    @patch(
        "sentry.integrations.github.webhook.should_create_or_increment_contributor_seat",
        return_value=True,
    )
    def test_seat_assignment_not_triggered_when_contributor_becomes_inactive(
        self,
        mock_should_create_or_increment_contributor_seat: MagicMock,
        mock_assign_seat: MagicMock,
    ) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        integration = self._create_integration_and_send_pull_request_opened_event()

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_identifier="6752317",
        )

        assert contributor.num_actions == 1
        mock_assign_seat.delay.assert_not_called()

    @patch("sentry.integrations.github.webhook.assign_seat_to_organization_contributor")
    @patch(
        "sentry.integrations.github.webhook.should_create_or_increment_contributor_seat",
        return_value=True,
    )
    def test_seat_assignment_triggered_when_contributor_becomes_active(
        self,
        mock_should_create_or_increment_contributor_seat: MagicMock,
        mock_assign_seat: MagicMock,
    ) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
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
            integration.add_organization(self.project.organization.id, self.user)

        contributor = OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_identifier="6752317",
            num_actions=1,
        )

        self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=6ab37f1f7c8b4f0c223d1c346855fc2ac47ee749",
            HTTP_X_HUB_SIGNATURE_256="sha256=a9f96076ede4be8eaf808e78c891287617af9d2292b7359c3dc3d063c3e356b8",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        contributor.refresh_from_db()
        assert contributor.num_actions == 2
        mock_assign_seat.delay.assert_called_once_with(contributor.id)

    @patch("sentry.integrations.github.webhook.assign_seat_to_organization_contributor")
    @patch(
        "sentry.integrations.github.webhook.should_create_or_increment_contributor_seat",
        return_value=True,
    )
    def test_no_contributor_tracking_for_bot_contributor(
        self,
        mock_should_create_or_increment_contributor_seat: MagicMock,
        mock_assign_seat: MagicMock,
    ) -> None:
        Repository.objects.create(
            organization_id=self.project.organization.id,
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
            integration.add_organization(self.project.organization.id, self.user)

        body = json.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)
        body["pull_request"]["user"]["type"] = "Bot"
        modified_body = json.dumps(body).encode("utf-8")

        self.client.post(
            path=self.url,
            data=modified_body,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE=self._get_signature_sha1(modified_body),
            HTTP_X_HUB_SIGNATURE_256=self._get_signature_sha256(modified_body),
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert not OrganizationContributors.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_identifier="6752317",
        ).exists()
        mock_assign_seat.delay.assert_not_called()


@with_feature("organizations:integrations-github-project-management")
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
