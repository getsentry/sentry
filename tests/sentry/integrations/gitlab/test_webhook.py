from __future__ import absolute_import

from sentry.models import (
    Commit,
    CommitAuthor,
    PullRequest
)
from .testutils import (
    GitLabTestCase,
    WEBHOOK_SECRET,
    MERGE_REQUEST_OPENED_EVENT,
    PUSH_EVENT,
    PUSH_EVENT_IGNORED_COMMIT
)

import pytest


class WebhookTest(GitLabTestCase):
    url = '/extensions/gitlab/webhook/'

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 405

    def test_unknown_event(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='lol'
        )
        assert response.status_code == 400

    def test_invalid_secret(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN='wrong',
            HTTP_X_GITLAB_EVENT='Push Hook'
        )
        assert response.status_code == 400

    def test_invalid_payload(self):
        response = self.client.post(
            self.url,
            data='lol not json',
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Push Hook'
        )
        assert response.status_code == 400

    def test_push_event_missing_repo(self):
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Push Hook'
        )
        assert response.status_code == 404

    def test_push_event_create_commits_annd_authors(self):
        repo = self.create_repo('getsentry/sentry')
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Push Hook'
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

        authors = CommitAuthor.objects.all()
        assert len(authors) == 2
        for author in authors:
            assert author.email
            assert 'example.org' in author.email
            assert author.name
            assert author.organization_id == self.organization.id

    def test_push_event_ignore_commit(self):
        self.create_repo('getsentry/sentry')
        response = self.client.post(
            self.url,
            data=PUSH_EVENT_IGNORED_COMMIT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Push Hook'
        )
        assert response.status_code == 204
        assert 0 == Commit.objects.count()

    def test_push_event_known_author(self):
        CommitAuthor.objects.create(
            organization_id=self.organization.id,
            email='jordi@example.org',
            name='Jordi'
        )
        self.create_repo('getsentry/sentry')
        response = self.client.post(
            self.url,
            data=PUSH_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Push Hook'
        )
        assert response.status_code == 204
        assert 2 == CommitAuthor.objects.count(), 'No dupes made'

    @pytest.mark.incomplete
    def test_push_event_create_commits_more_than_20(self):
        pass

    @pytest.mark.incomplete
    def test_merge_event_missing_repo(self):
        response = self.client.post(
            self.url,
            data=MERGE_REQUEST_OPENED_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Merge Request Hook'
        )
        assert response.status_code == 404

    @pytest.mark.incomplete
    def test_merge_event_create_pull_request(self):
        self.create_repo('getsentry/sentry')
        response = self.client.post(
            self.url,
            data=MERGE_REQUEST_OPENED_EVENT,
            content_type='application/json',
            HTTP_X_GITLAB_TOKEN=WEBHOOK_SECRET,
            HTTP_X_GITLAB_EVENT='Merge Request Hook'
        )
        assert response.status_code == 204
        author = CommitAuthor.objects.all().first()
        assert author.email
        assert author.name
        assert author.organization_id == self.organization.id

        pull = PullRequest.objects.all().first()
        assert pull.title
        assert pull.message
        assert pull.date_added
        assert pull.author == author
        assert pull.merge_commit_sha is None
        assert pull.organization_id == self.organization.id
