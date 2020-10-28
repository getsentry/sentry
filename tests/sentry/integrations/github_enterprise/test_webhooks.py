# -*- coding: utf-8 -*-
from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone
from sentry.models import Commit, CommitAuthor, Integration, PullRequest, Repository
from sentry.testutils import APITestCase
from uuid import uuid4

from .testutils import (
    PUSH_EVENT_EXAMPLE_INSTALLATION,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE,
    PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
)

from sentry.utils.compat.mock import patch


class WebhookTest(APITestCase):
    def test_get(self):
        url = "/extensions/github-enterprise/webhook/"

        response = self.client.get(url)
        assert response.status_code == 405

    def test_unknown_host_event(self):
        # No integration defined in the database, so event should be rejected
        # because we can't find metadata and secret for it
        url = "/extensions/github-enterprise/webhook/"

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="99.99.99.99",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )
        assert response.status_code == 400

    def test_unregistered_event(self):
        project = self.project  # force creation
        url = u"/extensions/github-enterprise/webhook/".format(project.organization.id)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="UnregisteredEvent",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=56a3df597e02adbc17fb617502c70e19d96a6136",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )
        assert response.status_code == 204

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_invalid_signature_event(self, mock_installation):
        mock_installation.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }
        url = "/extensions/github-enterprise/webhook/"

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )
        assert response.status_code == 401

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_missing_signature_ok(self, mock_installation):
        # Old Github:e doesn't send a signature, so we have to accept that.
        mock_installation.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }
        url = "/extensions/github-enterprise/webhook/"

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )
        assert response.status_code == 204


class PushEventWebhookTest(APITestCase):
    @patch("sentry.integrations.github_enterprise.client.get_jwt")
    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_simple(self, mock_get_installation_metadata, mock_get_jwt):
        mock_get_jwt.return_value = b""

        project = self.project  # force creation

        url = "/extensions/github-enterprise/webhook/"
        mock_get_installation_metadata.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )
        integration = Integration.objects.create(
            external_id="35.232.149.196:12345",
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation_id": "12345",
                "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
            },
        )
        integration.add_organization(project.organization, self.user)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
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
        assert commit.message == u"Update README.md (àgain)"
        assert commit.author.name == u"bàxterthehacker"
        assert commit.author.email == "baxterthehacker@users.noreply.github.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author.name == u"bàxterthehacker"
        assert commit.author.email == "baxterthehacker@users.noreply.github.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_anonymous_lookup(self, mock_get_installation_metadata):
        project = self.project  # force creation

        url = "/extensions/github-enterprise/webhook/"
        mock_get_installation_metadata.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

        integration = Integration.objects.create(
            provider="github_enterprise",
            external_id="35.232.149.196:12345",
            name="octocat",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
            },
        )
        integration.add_organization(project.organization, self.user)

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )

        CommitAuthor.objects.create(
            external_id="github_enterprise:baxterthehacker",
            organization_id=project.organization_id,
            email="baxterthehacker@example.com",
            name=u"bàxterthehacker",
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=project.organization_id)
            .select_related("author")
            .order_by("-date_added")
        )

        # should be skipping the #skipsentry commit
        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == "133d60480286590a610a0eb7352ff6e02b9674c4"
        assert commit.message == u"Update README.md (àgain)"
        assert commit.author.name == u"bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author.name == u"bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

    @patch("sentry.integrations.github_enterprise.client.get_jwt")
    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_multiple_orgs(self, mock_get_installation_metadata, mock_get_jwt):
        mock_get_jwt.return_value = b""

        project = self.project  # force creation

        url = "/extensions/github-enterprise/webhook/"
        mock_get_installation_metadata.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )
        integration = Integration.objects.create(
            external_id="35.232.149.196:12345",
            provider="github_enterprise",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation_id": "12345",
                "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
            },
        )
        integration.add_organization(project.organization, self.user)

        org2 = self.create_organization()
        project2 = self.create_project(organization=org2, name="bar")

        Repository.objects.create(
            organization_id=project2.organization.id,
            external_id="77",
            provider="integrations:github_enterprise",
            name="another/repo",
        )
        integration = Integration.objects.create(
            external_id="35.232.149.196:99",
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
        integration.add_organization(org2, self.user)

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=2a0586cc46490b17441834e1e143ec3d8c1fe032",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=project.organization_id)
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


class PullRequestEventWebhook(APITestCase):
    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_opened(self, mock_get_installation_metadata):
        project = self.project  # force creation

        url = "/extensions/github-enterprise/webhook/"
        mock_get_installation_metadata.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

        integration = Integration.objects.create(
            provider="github_enterprise",
            external_id="35.232.149.196:234",
            name="octocat",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
            },
        )
        integration.add_organization(project.organization, self.user)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=aa5b11bc52b9fac082cb59f9ee8667cb222c3aff",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=repo.id, organization_id=project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert pr.message == u"This is a pretty simple change that we need to pull into master."
        assert pr.title == u"Update the README with new information"
        assert pr.author.name == u"baxterthehacker"

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_edited(self, mock_get_installation_metadata):
        project = self.project  # force creation

        url = "/extensions/github-enterprise/webhook/"
        mock_get_installation_metadata.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

        integration = Integration.objects.create(
            provider="github_enterprise",
            external_id="35.232.149.196:234",
            name="octocat",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
            },
        )
        integration.add_organization(project.organization, self.user)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )

        pr = PullRequest.objects.create(
            key="1", repository_id=repo.id, organization_id=project.organization.id
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_EDITED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=b50a13afd33b514e8e62e603827ea62530f0690e",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        pr = PullRequest.objects.get(id=pr.id)

        assert pr.key == "1"
        assert pr.message == u"new edited body"
        assert pr.title == u"new edited title"
        assert pr.author.name == u"baxterthehacker"

    @patch("sentry.integrations.github_enterprise.webhook.get_installation_metadata")
    def test_closed(self, mock_get_installation_metadata):
        project = self.project  # force creation

        url = "/extensions/github-enterprise/webhook/"
        mock_get_installation_metadata.return_value = {
            "url": "35.232.149.196",
            "id": "2",
            "name": "test-app",
            "webhook_secret": "b3002c3e321d4b7880360d397db2ccfd",
            "private_key": "private_key",
            "verify_ssl": True,
        }

        integration = Integration.objects.create(
            provider="github_enterprise",
            external_id="35.232.149.196:234",
            name="octocat",
            metadata={
                "domain_name": "35.232.149.196/baxterthehacker",
                "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
            },
        )
        integration.add_organization(project.organization, self.user)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github_enterprise",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_GITHUB_ENTERPRISE_HOST="35.232.149.196",
            HTTP_X_HUB_SIGNATURE="sha1=dff1c803cf1e48c1b9aefe4a17952ea132758806",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=repo.id, organization_id=project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert pr.message == u"new closed body"
        assert pr.title == u"new closed title"
        assert pr.author.name == u"baxterthehacker"
        assert pr.merge_commit_sha == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
