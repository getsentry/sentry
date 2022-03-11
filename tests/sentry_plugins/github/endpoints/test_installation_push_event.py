from datetime import datetime
from uuid import uuid4

from django.utils import timezone

from sentry.models import Commit, Integration, Repository
from sentry.testutils import APITestCase
from sentry_plugins.github.testutils import PUSH_EVENT_EXAMPLE_INSTALLATION


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
