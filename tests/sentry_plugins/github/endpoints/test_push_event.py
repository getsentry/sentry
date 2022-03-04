from datetime import datetime
from uuid import uuid4

from django.utils import timezone

from sentry.models import Commit, CommitAuthor, OrganizationOption, Repository
from sentry.testutils import APITestCase
from sentry_plugins.github.testutils import PUSH_EVENT_EXAMPLE


class PushEventWebhookTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation

        url = f"/plugins/github/organizations/{project.organization.id}/webhook/"

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
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
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
        assert commit.message == "Update README.md (àgain)"
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@users.noreply.github.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@users.noreply.github.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

    def test_anonymous_lookup(self):
        project = self.project  # force creation

        url = f"/plugins/github/organizations/{project.organization.id}/webhook/"

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
            name="bàxterthehacker",
        )

        response = self.client.post(
            path=url,
            data=PUSH_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=98196e70369945ffa6b248cf70f7dc5e46dff241",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
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
        assert commit.message == "Update README.md (àgain)"
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)
