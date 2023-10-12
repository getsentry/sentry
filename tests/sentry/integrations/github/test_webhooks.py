from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from fixtures.github import (
    PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
    PULL_REQUEST_EDITED_EVENT_EXAMPLE,
    PULL_REQUEST_OPENED_EVENT_EXAMPLE,
    PUSH_EVENT_EXAMPLE_INSTALLATION,
)
from sentry import options
from sentry.constants import ObjectStatus
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test(stable=True)
class WebhookTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def test_get(self):
        response = self.client.get(self.url)

        assert response.status_code == 405

    def test_unregistered_event(self):
        project = self.project  # noqa force creation

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="UnregisteredEvent",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

    def test_invalid_signature_event(self):
        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=33521abeaaf9a57c2abf486e0ccd54d23cf36fec",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 401


@region_silo_test(stable=True)
class PushEventWebhookTest(APITestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _setup_repo_test(self, project):
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

    def test_simple(self):
        project = self.project  # force creation

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        self._setup_repo_test(project)

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
        assert commit.message == "Update hello.py"
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

        commit_filechanges = CommitFileChange.objects.all()
        assert len(commit_filechanges) == 4

        repo.refresh_from_db()
        assert set(repo.languages) == {"python", "javascript"}

    @patch("sentry.integrations.github.webhook.metrics")
    def test_creates_missing_repo(self, mock_metrics):
        project = self.project  # force creation

        self._setup_repo_test(project)

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0].organization_id == project.organization.id
        assert repos[0].external_id == "35129377"
        assert repos[0].provider == "integrations:github"
        assert repos[0].name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    def test_ignores_hidden_repo(self):
        project = self.project  # force creation

        repo = self.create_repo(
            project=project,
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        repo.status = ObjectStatus.HIDDEN
        repo.external_id = "35129377"
        repo.save()

        self._setup_repo_test(project)

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0] == repo

    def test_anonymous_lookup(self):
        project = self.project  # force creation

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        CommitAuthor.objects.create(
            external_id="github:baxterthehacker",
            organization_id=project.organization_id,
            email="baxterthehacker@example.com",
            name="bàxterthehacker",
        )

        self._setup_repo_test(project)

        commit_list = list(
            Commit.objects.filter(organization_id=project.organization_id)
            .select_related("author")
            .order_by("-date_added")
        )

        # should be skipping the #skipsentry commit
        assert len(commit_list) == 2

        commit = commit_list[0]

        assert commit.key == "133d60480286590a610a0eb7352ff6e02b9674c4"
        assert commit.message == "Update hello.py"
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 45, 15, tzinfo=timezone.utc)

        commit = commit_list[1]

        assert commit.key == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"
        assert commit.message == "Update README.md"
        assert commit.author.name == "bàxterthehacker"
        assert commit.author.email == "baxterthehacker@example.com"
        assert commit.date_added == datetime(2015, 5, 5, 23, 40, 15, tzinfo=timezone.utc)

        commit_filechanges = CommitFileChange.objects.all()
        assert len(commit_filechanges) == 4

        repo.refresh_from_db()
        assert set(repo.languages) == {"python", "javascript"}

    def test_multiple_orgs(self):
        project = self.project  # force creation

        Repository.objects.create(
            organization_id=project.organization.id,
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
            integration.add_organization(project.organization.id, self.user)

        org2 = self.create_organization()
        project2 = self.create_project(organization=org2, name="bar")

        self.create_repo(
            project=project2,
            provider="integrations:github",
            name="another/repo",
        )

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="99",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(org2.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
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

    @patch("sentry.integrations.github.webhook.metrics")
    def test_multiple_orgs_creates_missing_repos(self, mock_metrics):
        project = self.project  # force creation

        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)
            integration.add_organization(org2.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PUSH_EVENT_EXAMPLE_INSTALLATION,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="push",
            HTTP_X_HUB_SIGNATURE="sha1=2b116e7c1f7510b62727673b0f9acc0db951263a",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all().order_by("date_added")
        assert len(repos) == 2

        assert repos[0].organization_id == project.organization.id
        assert repos[1].organization_id == org2.id
        for repo in repos:
            assert repo.external_id == "35129377"
            assert repo.provider == "integrations:github"
            assert repo.name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    def test_multiple_orgs_ignores_hidden_repo(self):
        project = self.project  # force creation

        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)
            integration.add_organization(org2.id, self.user)

        repo = self.create_repo(
            project=project,
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
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0] == repo


@region_silo_test(stable=True)
class PullRequestEventWebhook(APITestCase):
    def setUp(self):
        self.url = "/extensions/github/webhook/"
        self.secret = "b3002c3e321d4b7880360d397db2ccfd"
        options.set("github-app.webhook-secret", self.secret)

    def _setup_repo_test(self, project):
        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=bc7ce12fc1058a35bf99355e6fc0e6da72c35de3",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

    def test_opened(self):
        project = self.project  # force creation
        group = self.create_group(project=project, short_id=7)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        self._setup_repo_test(project)

        prs = PullRequest.objects.filter(
            repository_id=repo.id, organization_id=project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert (
            pr.message
            == "This is a pretty simple change that we need to pull into master. Fixes BAR-7"
        )
        assert pr.title == "Update the README with new information"
        assert pr.author.name == "baxterthehacker"

        self.assert_group_link(group, pr)

    @patch("sentry.integrations.github.webhook.metrics")
    def test_creates_missing_repo(self, mock_metrics):
        project = self.project  # force creation
        self._setup_repo_test(project)

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0].organization_id == project.organization.id
        assert repos[0].external_id == "35129377"
        assert repos[0].provider == "integrations:github"
        assert repos[0].name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    def test_ignores_hidden_repo(self):
        project = self.project  # force creation

        repo = self.create_repo(
            project=project,
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )
        repo.status = ObjectStatus.HIDDEN
        repo.external_id = "35129377"
        repo.save()

        self._setup_repo_test(project)

        repos = Repository.objects.all()
        assert len(repos) == 1
        assert repos[0] == repo

    @patch("sentry.integrations.github.webhook.metrics")
    def test_multiple_orgs_creates_missing_repo(self, mock_metrics):
        project = self.project  # force creation

        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)
            integration.add_organization(org2.id, self.user)

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_OPENED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=bc7ce12fc1058a35bf99355e6fc0e6da72c35de3",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 2

        assert repos[0].organization_id == project.organization.id
        assert repos[1].organization_id == org2.id
        for repo in repos:
            assert repo.external_id == "35129377"
            assert repo.provider == "integrations:github"
            assert repo.name == "baxterthehacker/public-repo"
        mock_metrics.incr.assert_called_with("github.webhook.repository_created")

    def test_multiple_orgs_ignores_hidden_repo(self):
        project = self.project  # force creation

        org2 = self.create_organization()

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)
            integration.add_organization(org2.id, self.user)

        repo = self.create_repo(
            project=project,
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
            HTTP_X_HUB_SIGNATURE="sha1=bc7ce12fc1058a35bf99355e6fc0e6da72c35de3",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0] == repo

    def test_edited(self):
        project = self.project  # force creation
        group = self.create_group(project=project, short_id=7)

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
            integration.add_organization(project.organization.id, self.user)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github",
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
            HTTP_X_HUB_SIGNATURE="sha1=83100642f0cf5d7f6145cf8d04da5d00a09f890f",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        pr = PullRequest.objects.get(id=pr.id)

        assert pr.key == "1"
        assert pr.message == "new edited body. Fixes BAR-7"
        assert pr.title == "new edited title"
        assert pr.author.name == "baxterthehacker"

        self.assert_group_link(group, pr)

    def test_closed(self):
        project = self.project  # force creation

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                external_id="12345",
                provider="github",
                metadata={"access_token": "1234", "expires_at": future_expires.isoformat()},
            )
            integration.add_organization(project.organization.id, self.user)

        repo = Repository.objects.create(
            organization_id=project.organization.id,
            external_id="35129377",
            provider="integrations:github",
            name="baxterthehacker/public-repo",
        )

        response = self.client.post(
            path=self.url,
            data=PULL_REQUEST_CLOSED_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="pull_request",
            HTTP_X_HUB_SIGNATURE="sha1=49db856f5658b365b73a2fa73a7cffa543f4d3af",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        prs = PullRequest.objects.filter(
            repository_id=repo.id, organization_id=project.organization.id
        )

        assert len(prs) == 1

        pr = prs[0]

        assert pr.key == "1"
        assert pr.message == "new closed body"
        assert pr.title == "new closed title"
        assert pr.author.name == "baxterthehacker"
        assert pr.merge_commit_sha == "0d1a26e67d8f5eaf1f6ba5c57fc3c7d91ac0fd1c"

    def assert_group_link(self, group, pr):
        link = GroupLink.objects.all().first()
        assert link
        assert link.group_id == group.id
        assert link.linked_id == pr.id
        assert link.linked_type == GroupLink.LinkedType.pull_request
