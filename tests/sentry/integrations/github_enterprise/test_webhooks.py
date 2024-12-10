from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import responses

from fixtures.github_enterprise import (
    PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PUSH_EVENT_EXAMPLE_INSTALLATION,
)
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.testutils.asserts import assert_failure_metric, assert_success_metric
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options


class WebhookTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/github-enterprise/webhook/"
        self.metadata = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 405

    def test_unknown_host_event(self):
        # No integration defined in the database, so event should be rejected
        # because we can't find metadata and secret for it
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="99.99.99.99",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400

    def test_unregistered_event(self):
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="UnregisteredEvent",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=56a3df597e02adbc17fb617502c70e19d96a6136",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_missing_payload(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Webhook payload not found" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_missing_github_event_header(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Missing X-GitHub-Event header" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_invalid_json(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=b'{"some_key": "value"',  # missing closing bracket
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_invalid_signature_event(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 401
        assert b"Provided signature does not match the computed body signature" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_malformed_signature_too_short_sha1(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=33521a2abfcf36fec",  # hash is too short
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Signature value does not match the expected format" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_malformed_signature_no_value_sha1(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Signature value does not match the expected format" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_malformed_signature_too_short_sha256(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE_256="sha256=33521a2abfcf36fec",  # hash is too short
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Signature value does not match the expected format" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_malformed_signature_no_value_sha256(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE_256="sha256=",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Signature value does not match the expected format" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_sha256_signature_ok(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE_256="sha256=7fb2fed663d2f386f29c1cff8980e11738a435b7e3c9332c1ab1fcc870f8964b",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_sha256_signature_invalid(self, mock_installation):
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE_256="sha256=7fb2fed663d2f386f29c1cff8980e11738a435b7e3c9332c1ab1fcc870f8abcd",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 401
        assert b"Provided signature does not match the computed body signature" in response.content

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    @override_options({"github-enterprise-app.allowed-hosts-legacy-webhooks": ["35.232.149.196"]})
    def test_missing_signature_ok(self, mock_installation):
        # Old Github:e doesn't send a signature, so we have to accept that, but only for specific hosts.
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 204

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_missing_signature_fail_without_option_set(self, mock_installation):
        # Old Github:e doesn't send a signature, so we have to accept that, but only for specific hosts.
        mock_installation.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )
        assert response.status_code == 400
        assert b"Missing headers X-Hub-Signature-256 or X-Hub-Signature" in response.content


@patch("sentry.integrations.github_enterprise.client.get_jwt")
@patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
class PushEventWebhookTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/github-enterprise/webhook/"
        self.metadata = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }
        Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_simple(self, mock_record, mock_get_installation_metadata, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://35.232.149.196/extensions/github-enterprise/webhook/",
            status=204,
        )

        mock_get_jwt.return_value = ""
        mock_get_installation_metadata.return_value = self.metadata

        self.create_integration(
            external_id="35.232.149.196:12345",
            organization=self.project.organization,
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation_id": "12345",
                "installation": {
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(
                # organization_id=project.organization_id,
            )
            .select_related("author")
            .order_by("-date_added")
        )

        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == "133d60480286590a610a0eb7352ff6e02b9674c4"
        assert commit.message == "Update README.md (àgain)"
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

        assert_success_metric(mock_record)

    @responses.activate
    @patch("sentry.integrations.github.webhook.PushEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_webhook_error_metric(
        self, mock_record, mock_event, mock_get_installation_metadata, mock_get_jwt
    ):
        responses.add(
            responses.POST,
            "https://35.232.149.196/extensions/github-enterprise/webhook/",
            status=204,
        )

        mock_get_jwt.return_value = ""
        mock_get_installation_metadata.return_value = self.metadata

        self.create_integration(
            external_id="35.232.149.196:12345",
            organization=self.project.organization,
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation_id": "12345",
                "installation": {
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )

        error = Exception("error")
        mock_event.side_effect = error

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 500

        assert_failure_metric(mock_record, error)

    def test_anonymous_lookup(self, mock_get_installation_metadata, mock_get_jwt):
        mock_get_installation_metadata.return_value = self.metadata

        self.create_integration(
            external_id="35.232.149.196:12345",
            organization=self.project.organization,
            provider="github_enterprise",
            name="octocat",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation": {
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )

        CommitAuthor.objects.create(
            external_id="github_enterprise:baxterthehacker",
            organization_id=self.project.organization_id,
            email="baxterthehacker@example.com",
            name="bàxterthehacker",
        )

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=self.project.organization_id)
            .select_related("author")
            .order_by("-date_added")
        )

        # should be skipping the #skipsentry commit
        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == "133d60480286590a610a0eb7352ff6e02b9674c4"
        assert commit.message == "Update README.md (àgain)"
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

    @responses.activate
    def test_multiple_orgs(self, mock_get_installation_metadata, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://35.232.149.196/extensions/github-enterprise/webhook/",
            status=204,
        )

        mock_get_jwt.return_value = ""
        mock_get_installation_metadata.return_value = self.metadata

        self.create_integration(
            external_id="35.232.149.196:12345",
            organization=self.project.organization,
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation_id": "12345",
                "installation": {
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )

        org2 = self.create_organization()
        project2 = self.create_project(organization=org2, name="bar")

        Repository.objects.create(
            organization_id=project2.organization.id,
            external_id="77",
            provider="integrations:github_enterprise",
            name="another/repo",
        )

        self.create_integration(
            external_id="35.232.149.196:99",
            organization=org2,
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/another",
                "installation": {
                    "installation_id": "99",
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=self.project.organization_id)
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


@patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
class PullRequestEventWebhook(APITestCase):
    def setUp(self):
        self.url = "/extensions/github-enterprise/webhook/"
        self.metadata = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }
        self.create_integration(
            external_id="35.232.149.196:234",
            organization=self.project.organization,
            provider="github_enterprise",
            name="octocat",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation": {
                    "id": "2",
                    "private_key": "private_key",
                    "verify_ssl": True,
                },
            },
        )
        self.repo = Repository.objects.create(
            organization_id=self.project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_opened(self, mock_record, mock_get_installation_metadata):
        mock_get_installation_metadata.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=aa5b11bc52b9fac082cb59f9ee8667cb222c3aff",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=self.repo.id, organization_id=self.project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert pr.message == "This is a pretty simple change that we need to pull into master."
        assert pr.title == "Update the README with new information"
        assert pr.author is not None
        assert pr.author.name == "baxterthehacker"

        assert_success_metric(mock_record)

    @patch("sentry.integrations.github.webhook.PullRequestEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_webhook_error_metric(self, mock_record, mock_event, mock_get_installation_metadata):
        mock_get_installation_metadata.return_value = self.metadata
        error = Exception("error")
        mock_event.side_effect = error

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=aa5b11bc52b9fac082cb59f9ee8667cb222c3aff",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 500

        assert_failure_metric(mock_record, error)

    def test_edited(self, mock_get_installation_metadata):
        mock_get_installation_metadata.return_value = self.metadata

        pr = PullRequest.objects.create(
            key="1",
            repository_id=self.repo.id,
            organization_id=self.project.organization.id,
        )

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_EDITED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=b50a13afd33b514e8e62e603827ea62530f0690e",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        pr = PullRequest.objects.get(id=pr.id)

        assert pr.key == "1"
        assert pr.message == "new edited body"
        assert pr.title == "new edited title"
        assert pr.author is not None
        assert pr.author.name == "baxterthehacker"

    def test_closed(self, mock_get_installation_metadata):
        mock_get_installation_metadata.return_value = self.metadata

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=dff1c803cf1e48c1b9aefe4a17952ea132758806",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=self.repo.id, organization_id=self.project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert pr.message == "new closed body"
        assert pr.title == "new closed title"
        assert pr.author is not None
        assert pr.author.name == "baxterthehacker"
        assert pr.merge_commit_sha == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
