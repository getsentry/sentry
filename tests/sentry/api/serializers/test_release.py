# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import six

from django.utils import timezone
from uuid import uuid4

from sentry import tagstore
from sentry.api.endpoints.organization_releases import ReleaseSerializerWithProjects
from sentry.api.serializers import serialize
from sentry.models import (
    Commit,
    CommitAuthor,
    Deploy,
    Environment,
    Release,
    ReleaseCommit,
    ReleaseProject,
    User,
    UserEmail,
)
from sentry.testutils import TestCase


class ReleaseSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        project2 = self.create_project(organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        release.add_project(project2)
        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=1)
        ReleaseProject.objects.filter(release=release, project=project2).update(new_groups=1)
        key = 'sentry:release'
        value = release.version
        tagstore.create_tag_value(
            project_id=project.id,
            environment_id=None,
            key=key,
            value=value,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
            times_seen=5,
        )
        tagstore.create_tag_value(
            project_id=project2.id,
            environment_id=None,
            key=key,
            value=value,
            first_seen=timezone.now() - datetime.timedelta(days=2),
            last_seen=timezone.now() - datetime.timedelta(days=1),
            times_seen=5,
        )
        commit_author = CommitAuthor.objects.create(
            name='stebe',
            email='stebe@sentry.io',
            organization_id=project.organization_id,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            author=commit_author,
            message='waddap',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        release.update(
            authors=[six.text_type(commit_author.id)],
            commit_count=1,
            last_commit_id=commit.id,
        )

        result = serialize(release, user)
        assert result['version'] == release.version
        assert result['shortVersion'] == release.version
        # should be sum of all projects
        assert result['newGroups'] == 2
        # should be tags from all projects
        tagvalue1 = tagstore.get_tag_value(project.id, None, key, value)
        tagvalue2 = tagstore.get_tag_value(project2.id, None, key, value)
        assert result['firstEvent'] == tagvalue2.first_seen
        assert result['lastEvent'] == tagvalue1.last_seen
        assert result['commitCount'] == 1
        assert result['authors'] == [{'name': 'stebe', 'email': 'stebe@sentry.io'}]

        result = serialize(release, user, project=project)
        # should be groups from one project
        assert result['newGroups'] == 1
        # should be tags from one project
        assert result['firstEvent'] == tagvalue1.first_seen
        assert result['lastEvent'] == tagvalue1.last_seen

        # Make sure a sha1 value gets truncated
        release.version = '0' * 40
        result = serialize(release, user)
        assert result['shortVersion'] == '0' * 7

    def test_no_tag_data(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name='stebe',
            email='stebe@sentry.io',
            organization_id=project.organization_id,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            author=commit_author,
            message='waddap',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        result = serialize(release, user)
        assert result['version'] == release.version
        assert not result['firstEvent']
        assert not result['lastEvent']

    def test_get_user_from_email(self):
        user = User.objects.create(email='stebe@sentry.io')
        UserEmail.get_primary_email(user=user)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
            new_groups=1,
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name='stebe',
            email='stebe@sentry.io',
            organization_id=project.organization_id,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            author=commit_author,
            message='waddap',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        release.update(
            authors=[six.text_type(commit_author.id)],
            commit_count=1,
            last_commit_id=commit.id,
        )

        result = serialize(release, user)
        result_author = result['authors'][0]
        assert int(result_author['id']) == user.id
        assert result_author['email'] == user.email
        assert result_author['username'] == user.username

    def test_get_single_user_from_email(self):
        """
        Tests that the first useremail will be used to
        associate a user with a commit author email
        """
        user = User.objects.create(email='stebe@sentry.io')
        otheruser = User.objects.create(email='adifferentstebe@sentry.io')
        UserEmail.objects.create(email='stebe@sentry.io', user=otheruser)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
            new_groups=1,
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name='stebe',
            email='stebe@sentry.io',
            organization_id=project.organization_id,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            author=commit_author,
            message='waddap',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        release.update(
            authors=[six.text_type(commit_author.id)],
            commit_count=1,
            last_commit_id=commit.id,
        )

        result = serialize(release, user)
        assert len(result['authors']) == 1
        result_author = result['authors'][0]
        assert int(result_author['id']) == user.id
        assert result_author['email'] == user.email
        assert result_author['username'] == user.username

    def test_select_user_from_appropriate_org(self):
        """
        Tests that a user not belonging to the organization
        is not returned as the author
        """
        user = User.objects.create(email='stebe@sentry.io')
        email = UserEmail.objects.get(user=user, email='stebe@sentry.io')
        otheruser = User.objects.create(email='adifferentstebe@sentry.io')
        otheremail = UserEmail.objects.create(email='stebe@sentry.io', user=otheruser)
        project = self.create_project()
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
            new_groups=1,
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name='stebe',
            email='stebe@sentry.io',
            organization_id=project.organization_id,
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            author=commit_author,
            message='waddap',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        release.update(
            authors=[six.text_type(commit_author.id)],
            commit_count=1,
            last_commit_id=commit.id,
        )

        assert email.id < otheremail.id
        result = serialize(release, user)
        assert len(result['authors']) == 1
        result_author = result['authors'][0]
        assert int(result_author['id']) == otheruser.id
        assert result_author['email'] == otheruser.email
        assert result_author['username'] == otheruser.username

    def test_no_commit_author(self):
        user = User.objects.create(email='stebe@sentry.io')
        otheruser = User.objects.create(email='adifferentstebe@sentry.io')
        project = self.create_project()
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
            new_groups=1,
        )
        release.add_project(project)
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            message='waddap',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        result = serialize(release, user)
        assert result['authors'] == []

    def test_deduplicate_users(self):
        """
        Tests that the same user is not returned more than once
        if there are commits associated with multiple of their
        emails
        """
        user = User.objects.create(email='stebe@sentry.io')
        email = UserEmail.objects.get(user=user, email='stebe@sentry.io')
        otheremail = UserEmail.objects.create(email='alsostebe@sentry.io', user=user)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
            new_groups=1,
        )
        release.add_project(project)
        commit_author1 = CommitAuthor.objects.create(
            name='stebe',
            email=email.email,
            organization_id=project.organization_id,
        )
        commit_author2 = CommitAuthor.objects.create(
            name='stebe',
            email=otheremail.email,
            organization_id=project.organization_id,
        )
        commit1 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='abc',
            author=commit_author1,
            message='waddap',
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key='cde',
            author=commit_author2,
            message='oh hi',
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit1,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit2,
            order=2,
        )
        release.update(
            authors=[
                six.text_type(commit_author1.id),
                six.text_type(commit_author2.id),
            ],
            commit_count=2,
            last_commit_id=commit2.id,
        )
        result = serialize(release, user)
        assert len(result['authors']) == 1
        assert result['authors'][0]['email'] == 'stebe@sentry.io'

    def test_with_deploy(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=1)
        env = Environment.objects.create(
            organization_id=project.organization_id,
            name='production',
        )
        env.add_project(project)
        deploy = Deploy.objects.create(
            organization_id=project.organization_id,
            release=release,
            environment_id=env.id,
        )
        release.update(total_deploys=1, last_deploy_id=deploy.id)

        result = serialize(release, user)
        assert result['version'] == release.version
        assert result['deployCount'] == 1
        assert result['lastDeploy']['id'] == six.text_type(deploy.id)

    def test_release_no_users(self):
        """
        Testing when a repo gets deleted leaving dangling last commit id and author_ids
        Made the decision that the Serializer must handle the data even in the case that the
        commit_id or the author_ids point to records that do not exist.
        """
        commit_id = 9999999
        commit_author_id = 9999999

        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex,
            authors=[
                six.text_type(commit_author_id),
            ],
            commit_count=1,
            last_commit_id=commit_id,
        )
        release.add_project(project)
        serialize(release)


class ReleaseRefsSerializerTest(TestCase):
    def test_simple(self):
        # test bad refs
        data = {'version': 'a' * 40, 'projects': ['earth'], 'refs': [None]}

        serializer = ReleaseSerializerWithProjects(data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            'refs': ['non_field_errors: No input provided'],
        }

        # test good refs
        data = {
            'version': 'a' * 40,
            'projects': ['earth'],
            'refs': [{
                'repository': 'my-repo',
                'commit': 'b' * 40,
            }]
        }

        serializer = ReleaseSerializerWithProjects(data=data)

        assert serializer.is_valid()
