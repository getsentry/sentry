# -*- coding: utf-8 -*-

from __future__ import absolute_import

from uuid import uuid4

from sentry.api.serializers import serialize
from sentry.models import Commit, CommitAuthor, CommitFileChange, Release, ReleaseCommit, Repository
from sentry.testutils import TestCase


class CommitFileChangeSerializerTest(TestCase):
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
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        cfc = CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore", type="M"
        )
        result = serialize(cfc, user)

        assert result["filename"] == ".gitignore"
        assert result["commitMessage"] == "waddap"
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
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key="abc",
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        cfc = CommitFileChange.objects.create(
            organization_id=project.organization_id, commit=commit, filename=".gitignore", type="M"
        )

        result = serialize(cfc, user)

        assert result["author"] == {}
