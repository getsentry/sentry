from fixtures.gitlab import (
    EXTERNAL_ID,
    MERGE_REQUEST_OPENED_EVENT,
    PUSH_EVENT,
    PUSH_EVENT_IGNORED_COMMIT,
    WEBHOOK_TOKEN,
    GitLabTestCase,
)
from sentry.models import Commit, CommitAuthor, GroupLink, PullRequest
from sentry.utils import json


class WebhookTest(GitLabTestCase):
    url = "/extensions/gitlab/webhook/"

    def assert_commit_author(self, author):
        assert author.email
        assert author.name
        assert author.organization_id == self.organization.id

    def assert_pull_request(self, pull, author):
        assert pull.title
        assert pull.message
        assert pull.date_added
        assert pull.author == author
        assert pull.merge_commit_sha is None
        assert pull.organization_id == self.organization.id

    def assert_group_link(self, group, pull):
        link = GroupLink.objects.all().first()
        assert link.group_id == group.id
        assert link.linked_type == GroupLink.LinkedType.pull_request
        assert link.linked_id == pull.id

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 405
        assert response.reason_phrase == "HTTP method not supported."

    def test_missing_x_gitlab_token(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_EVENT="lol",
        )
        assert response.status_code == 400
        assert (
            response.reason_phrase == "The customer needs to set a Secret Token in their webhook."
        )

    def test_unknown_event(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="lol",
        )
        assert response.status_code == 400
        assert (
            response.reason_phrase
            == "The customer has edited the webhook in Gitlab to include other types of events."
        )

    def test_invalid_token(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN="wrong",
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 400
        assert response.reason_phrase == "The customer's Secret Token is malformed."

    def test_valid_id_invalid_secret(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=f"{EXTERNAL_ID}:wrong",
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 400
        assert (
            response.reason_phrase
            == "Gitlab's webhook secret does not match. Refresh token (or re-install the integration) by following this https://docs.sentry.io/product/integrations/integration-platform/public-integration/#refreshing-tokens."
        )

    def test_invalid_payload(self):
        response = self.client.post(
            self.url,
            data="lol not json",
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 400
        assert response.reason_phrase == "Data received is not JSON."

    def test_push_event_missing_repo(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        # Missing repositories don't 40x as we can't explode
        # on missing repositories due to the possibility of multiple
        # organizations sharing an integration and not having the same
        # repositories enabled.
        assert response.status_code == 204

    def test_push_event_multiple_organizations_one_missing_repo(self):
        # Create a repo on the primary organization
        repo = self.create_repo("getsentry/sentry")

        # Second org with no repo.
        other_org = self.create_organization(owner=self.user)
        self.integration.add_organization(other_org, self.user)

        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 204
        commits = Commit.objects.all()
        assert len(commits) == 2
        for commit in commits:
            assert commit.organization_id == self.organization.id
            assert commit.repository_id == repo.id

    def test_push_event_multiple_organizations(self):
        # Create a repo on the primary organization
        repo = self.create_repo("getsentry/sentry")

        # Second org with the same repo
        other_org = self.create_organization(owner=self.user)
        self.integration.add_organization(other_org, self.user)
        other_repo = self.create_repo("getsentry/sentry", organization_id=other_org.id)

        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 204

        commits = Commit.objects.filter(repository_id=repo.id).all()
        assert len(commits) == 2
        for commit in commits:
            assert commit.organization_id == self.organization.id

        commits = Commit.objects.filter(repository_id=other_repo.id).all()
        assert len(commits) == 2
        for commit in commits:
            assert commit.organization_id == other_org.id

    def test_push_event_create_commits_and_authors(self):
        repo = self.create_repo("getsentry/sentry")
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 204

        commits = Commit.objects.all()
        assert len(commits) == 2
        for commit in commits:
            assert commit.key
            assert commit.message
            assert commit.author
            assert commit.date_added
            assert commit.repository_id == repo.id
            assert commit.organization_id == self.organization.id

        authors = CommitAuthor.objects.all()
        assert len(authors) == 2
        for author in authors:
            assert author.email
            assert "example.org" in author.email
            assert author.name
            assert author.organization_id == self.organization.id

    def test_push_event_ignore_commit(self):
        self.create_repo("getsentry/sentry")
        response = self.client.post(
            self.url,
            data=PUSH_EVENT_IGNORED_COMMIT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 204
        assert 0 == Commit.objects.count()

    def test_push_event_known_author(self):
        CommitAuthor.objects.create(
            organization_id=self.organization.id, email="jordi@example.org", name="Jordi"
        )
        self.create_repo("getsentry/sentry")
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        assert response.status_code == 204
        assert 2 == CommitAuthor.objects.count(), "No dupes made"

    def test_merge_event_missing_repo(self):
        response = self.client.post(
            self.url,
            data=MERGE_REQUEST_OPENED_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Merge Request Hook",
        )
        assert response.status_code == 204
        assert 0 == PullRequest.objects.count()

    def test_merge_event_no_last_commit(self):
        payload = json.loads(MERGE_REQUEST_OPENED_EVENT)

        # Remove required keys. There have been events in prod that are missing
        # these important attributes. GitLab docs don't explain why though.
        del payload["object_attributes"]["last_commit"]

        response = self.client.post(
            self.url,
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Merge Request Hook",
        )
        assert response.status_code == 204
        assert 0 == PullRequest.objects.count()

    def test_merge_event_create_pull_request(self):
        self.create_repo("getsentry/sentry")
        group = self.create_group(project=self.project, short_id=9)
        response = self.client.post(
            self.url,
            data=MERGE_REQUEST_OPENED_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Merge Request Hook",
        )
        assert response.status_code == 204
        author = CommitAuthor.objects.all().first()
        self.assert_commit_author(author)

        pull = PullRequest.objects.all().first()
        self.assert_pull_request(pull, author)
        self.assert_group_link(group, pull)

    def test_merge_event_update_pull_request(self):
        repo = self.create_repo("getsentry/sentry")
        group = self.create_group(project=self.project, short_id=9)
        PullRequest.objects.create(
            organization_id=self.organization.id,
            repository_id=repo.id,
            key=1,
            title="Old title",
            message="Old message",
        )

        response = self.client.post(
            self.url,
            data=MERGE_REQUEST_OPENED_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Merge Request Hook",
        )
        assert response.status_code == 204
        author = CommitAuthor.objects.all().first()
        self.assert_commit_author(author)

        pull = PullRequest.objects.all().first()
        assert pull.title != "Old title"
        assert pull.message != "Old message"

        self.assert_pull_request(pull, author)
        self.assert_group_link(group, pull)

    def test_update_repo_path(self):
        repo_out_of_date_path = self.create_repo(
            name="Cool Group / Sentry", url="http://example.com/cool-group/sentry"
        )
        repo_out_of_date_path.update(
            config=dict(
                repo_out_of_date_path.config, path="uncool-group/sentry"  # path out of date
            )
        )

        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )

        assert response.status_code == 204

        # path has been updated
        repo_out_of_date_path.refresh_from_db()
        assert repo_out_of_date_path.config["path"] == "cool-group/sentry"

    def test_update_repo_url(self):
        repo_out_of_date_url = self.create_repo(
            name="Cool Group / Sentry",
            url="http://example.com/uncool-group/sentry",  # url out of date
        )
        repo_out_of_date_url.update(
            config=dict(repo_out_of_date_url.config, path="cool-group/sentry")
        )

        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )

        assert response.status_code == 204

        # url has been updated
        repo_out_of_date_url.refresh_from_db()
        assert repo_out_of_date_url.url == "http://example.com/cool-group/sentry"
