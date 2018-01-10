# -*- coding: utf-8 -*-

from __future__ import absolute_import

from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.models import (PullRequest, CommitAuthor, Release, Repository)
from sentry.testutils import TestCase


class PullRequestSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
        )
        release.add_project(project)
        repository = Repository.objects.create(
            organization_id=project.organization_id,
            name='test/test',
        )
        commit_author = CommitAuthor.objects.create(
            name='stebe',
            email='stebe@sentry.io',
            organization_id=project.organization_id,
        )
        pull_request = PullRequest.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key='9',
            author=commit_author,
            message='waddap',
            title="cool pr"
        )

        result = serialize(pull_request, user)

        assert result['message'] == 'waddap'
        assert result['title'] == 'cool pr'
        assert result['repository']['name'] == 'test/test'
        assert result['author'] == {'name': 'stebe', 'email': 'stebe@sentry.io'}

    def test_no_author(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
        )
        release.add_project(project)
        repository = Repository.objects.create(
            organization_id=project.organization_id,
            name='test/test',
        )
        pull_requst = PullRequest.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key='abc',
            message='waddap',
        )

        result = serialize(pull_requst, user)

        assert result['author'] == {}
