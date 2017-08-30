from __future__ import absolute_import

import six
from hashlib import sha1
from mock import patch
from uuid import uuid4

from sentry.models import (
    Activity, Commit, CommitAuthor, GroupAssignee, GroupCommitResolution, OrganizationMember,
    Release, Repository, TagValue, UserEmail
)
from sentry.testutils import TestCase


class EnsureReleaseExistsTest(TestCase):
    def test_simple(self):
        tv = TagValue.objects.create(
            project_id=self.project.id,
            key='sentry:release',
            value='1.0',
        )

        tv = TagValue.objects.get(id=tv.id)
        assert tv.data['release_id']

        release = Release.objects.get(id=tv.data['release_id'])
        assert release.version == tv.value
        assert release.projects.first() == self.project
        assert release.organization == self.project.organization

        # ensure we dont hit some kind of error saving it again
        tv.save()


class ResolveGroupResolutionsTest(TestCase):
    @patch('sentry.tasks.clear_expired_resolutions.clear_expired_resolutions.delay')
    def test_simple(self, mock_delay):
        release = Release.objects.create(
            version='a',
            organization_id=self.project.organization_id,
        )
        release.add_project(self.project)

        mock_delay.assert_called_once_with(
            release_id=release.id,
        )


class ResolvedInCommitTest(TestCase):
    # TODO(dcramer): pull out short ID matching and expand regexp tests
    def test_simple(self):
        group = self.create_group()

        repo = Repository.objects.create(
            name='example',
            organization_id=self.group.organization.id,
        )

        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message='Foo Biz\n\nFixes {}'.format(group.qualified_short_id),
        )

        assert GroupCommitResolution.objects.filter(
            group_id=group.id,
            commit_id=commit.id,
        ).exists()

    def test_no_matching_group(self):
        repo = Repository.objects.create(
            name='example',
            organization_id=self.organization.id,
        )

        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=self.organization.id,
            message='Foo Biz\n\nFixes {}-12F'.format(
                self.project.slug.upper()),
        )

        assert not GroupCommitResolution.objects.filter(
            commit_id=commit.id,
        ).exists()

    def test_matching_author(self):
        group = self.create_group()

        repo = Repository.objects.create(
            name='example',
            organization_id=self.group.organization.id,
        )

        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message='Foo Biz\n\nFixes {}'.format(group.qualified_short_id),
            author=CommitAuthor.objects.create(
                organization_id=group.organization.id,
                name=self.user.name,
                email=self.user.email,
            )
        )

        assert GroupCommitResolution.objects.filter(
            group_id=group.id,
            commit_id=commit.id,
        ).exists()

    def test_assigns_author(self):
        group = self.create_group()
        user = self.create_user(
            name='Foo Bar', email='foo@example.com', is_active=True)
        email = UserEmail.get_primary_email(user=user)
        email.is_verified = True
        email.save()
        repo = Repository.objects.create(
            name='example',
            organization_id=self.group.organization.id,
        )
        OrganizationMember.objects.create(
            organization=group.project.organization, user=user)
        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            organization_id=group.organization.id,
            repository_id=repo.id,
            message='Foo Biz\n\nFixes {}'.format(group.qualified_short_id),
            author=CommitAuthor.objects.create(
                organization_id=group.organization.id,
                name=user.name,
                email=user.email,
            )
        )

        assert GroupCommitResolution.objects.filter(
            group_id=group.id,
            commit_id=commit.id,
        ).exists()

        assert GroupAssignee.objects.filter(group=group, user=user).exists()

        self.assertEqual(Activity.objects.filter(project=group.project,
                                                 group=group,
                                                 type=Activity.ASSIGNED,
                                                 user=user,)[0].data, {'assignee': six.text_type(user.id), 'assigneeEmail': user.email})
