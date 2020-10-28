# -*- coding: utf-8 -*-
from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone
from sentry.models import (
    Commit,
    CommitAuthor,
    Integration,
    OrganizationOption,
    PullRequest,
    Repository,
)
from sentry.testutils import APITestCase
from uuid import uuid4

from sentry_plugins.github.testutils import (
    INSTALLATION_EVENT_EXAMPLE,
    INSTALLATION_REPO_EVENT,
    PUSH_EVENT_EXAMPLE,
    PUSH_EVENT_EXAMPLE_INSTALLATION,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE,
    PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
)


class WebhookTest(APITestCase):
    def test_get(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        response = self.client.get(url)

        assert response.status_code == 405

    def test_unregistered_event(self):
        project = self.project  # force creation
        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="UnregisteredEvent",
            HTTP_X_HUB_SIGNATURE="sha1=98196e70369945ffa6b248cf70f7dc5e46dff241",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

    def test_invalid_signature_event(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "2d7565c3537847b789d6995dca8d9f84"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 401


class PushEventWebhookTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="github",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=98196e70369945ffa6b248cf70f7dc5e46dff241",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=project.organization_id)
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

    def test_anonymous_lookup(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="github",
            name="baxterthehacker/public-repo",
        )

        CommitAuthor.objects.create(
            external_id="github:baxterthehacker",
            organization_id=project.organization_id,
            email="baxterthehacker@example.com",
            name=u"bàxterthehacker",
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=98196e70369945ffa6b248cf70f7dc5e46dff241",
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


class InstallationPushEventWebhookTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation

        url = "/plugins/github/installations/webhook/"

        inst = Integration.objects.create(
            provider="github_apps", external_id="12345", name="dummyorg"
        )

        inst.add_organization(self.project.organization)

        Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="github_apps",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=56a3df597e02adbc17fb617502c70e19d96a6136",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        commit_list = list(
            Commit.objects.filter(organization_id=project.organization_id)
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


class InstallationInstallEventWebhookTest(APITestCase):
    def test_simple(self):
        url = "/plugins/github/installations/webhook/"

        response = self.client.post(
            path=url,
            data=INSTALLATION_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=348e46312df2901e8cb945616ee84ce30d9987c9",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        assert Integration.objects.filter(
            provider="github_apps", external_id=2, name="octocat"
        ).exists()


class InstallationRepoInstallEventWebhookTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation

        url = "/plugins/github/installations/webhook/"

        integration = Integration.objects.create(
            provider="github_apps", external_id="2", name="octocat"
        )

        integration.add_organization(project.organization)

        response = self.client.post(
            path=url,
            data=INSTALLATION_REPO_EVENT,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation_repositories",
            HTTP_X_HUB_SIGNATURE="sha1=6899797a97dc5bb6aab3af927e92e881d03a3bd2",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        assert Repository.objects.filter(
            provider="github",
            name="octocat/Hello-World",
            external_id=1296269,
            organization_id=project.organization_id,
        ).exists()

    def test_updates_existing_repo(self):
        project = self.project  # force creation

        url = "/plugins/github/installations/webhook/"

        integration = Integration.objects.create(
            provider="github_apps", external_id="2", name="octocat"
        )

        integration.add_organization(project.organization)

        repo = Repository.objects.create(
            provider="github",
            name="octocat/Hello-World",
            external_id=1296269,
            organization_id=project.organization_id,
        )
        assert "name" not in repo.config

        response = self.client.post(
            path=url,
            data=INSTALLATION_REPO_EVENT,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation_repositories",
            HTTP_X_HUB_SIGNATURE="sha1=6899797a97dc5bb6aab3af927e92e881d03a3bd2",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        repo = Repository.objects.get(id=repo.id)
        assert repo.integration_id == integration.id
        assert repo.config["name"] == repo.name


class PullRequestEventWebhook(APITestCase):
    def test_opened(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="github_apps",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
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

    def test_edited(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="github_apps",
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
            HTTP_X_HUB_SIGNATURE="sha1=b50a13afd33b514e8e62e603827ea62530f0690e",
            HTTP_X_GITHUB_DELIVERY=six.text_type(uuid4()),
        )

        assert response.status_code == 204

        pr = PullRequest.objects.get(id=pr.id)

        assert pr.key == "1"
        assert pr.message == u"new edited body"
        assert pr.title == u"new edited title"
        assert pr.author.name == u"baxterthehacker"

    def test_closed(self):
        project = self.project  # force creation

        url = "/plugins/github/organizations/{}/webhook/".format(project.organization.id)

        secret = "b3002c3e321d4b7880360d397db2ccfd"

        OrganizationOption.objects.set_value(
            organization=project.organization, key="github:webhook_secret", value=secret
        )

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="github_apps",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=url,
            data=PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
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
