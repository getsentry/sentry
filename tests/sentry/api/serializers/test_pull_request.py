# -*- coding: utf-8 -*-

from __future__ import absolute_import

from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.models import PullRequest, CommitAuthor, Release, Repository
from sentry.plugins.base import bindings
from sentry.testutils import TestCase


class PullRequestSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        repository = Repository.objects.create(
            organization_id=project.organization_id, name="test/test"
        )
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        pull_request = PullRequest.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key="9",
            author=commit_author,
            message="waddap",
            title="cool pr",
        )

        result = serialize(pull_request, user)

        assert result["message"] == "waddap"
        assert result["title"] == "cool pr"
        assert result["repository"]["name"] == "test/test"
        assert result["author"] == {"name": "stebe", "email": "stebe@sentry.io"}

    def test_no_author(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        repository = Repository.objects.create(
            organization_id=project.organization_id, name="test/test"
        )
        pull_request = PullRequest.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key="abc",
            message="waddap",
        )

        result = serialize(pull_request, user)

        assert result["author"] == {}

    def test_integration_repository(self):
        # Add binding in case they aren't set.
        bindings.add(
            "integration-repository.provider", GitHubRepositoryProvider, id="integrations:github"
        )

        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        repository = Repository.objects.create(
            organization_id=project.organization_id,
            name="test/test",
            provider="integrations:github",
            url="https://github.com/test/test",
        )
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        pull_request = PullRequest.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key="9",
            author=commit_author,
            message="waddap",
            title="cool pr",
        )

        result = serialize(pull_request, user)

        assert result["externalUrl"] == "https://github.com/test/test/pull/9"
        assert result["message"] == "waddap"
        assert result["title"] == "cool pr"
        assert result["repository"]["name"] == "test/test"
        assert result["author"] == {"name": "stebe", "email": "stebe@sentry.io"}

    def test_deleted_repository(self):
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=self.project.organization_id
        )
        pull_request = PullRequest.objects.create(
            organization_id=self.project.organization_id,
            repository_id=12345,
            key="9",
            author=commit_author,
            message="waddap",
            title="cool pr",
        )
        result = serialize(pull_request, self.user)

        assert result["message"] == pull_request.message
        assert result["title"] == pull_request.title
        assert result["repository"] == {}
        assert result["author"] == {"name": commit_author.name, "email": commit_author.email}
        assert result["externalUrl"] == ""
