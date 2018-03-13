from __future__ import absolute_import

import six
from hashlib import sha1
from mock import patch
from uuid import uuid4

from sentry import tagstore
from sentry.models import (
    Activity, Commit, CommitAuthor, GroupAssignee, GroupLink, OrganizationMember,
    Release, Repository, UserEmail
)
from sentry.testutils import TestCase


class EnsureReleaseExistsTest(TestCase):
    def test_simple(self):
        tv = tagstore.create_tag_value(
            project_id=self.project.id,
            environment_id=self.environment.id,
            key='sentry:release',
            value='1.0',
        )

        tv = tagstore.get_tag_value(self.project.id, self.environment.id, 'sentry:release', '1.0')
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

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

    def test_updating_commit(self):
        group = self.create_group()

        repo = Repository.objects.create(
            name='example',
            organization_id=self.group.organization.id,
        )

        commit = Commit.objects.create(
            key=sha1(uuid4().hex).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
        )

        assert not GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        commit.message = 'Foo Biz\n\nFixes {}'.format(group.qualified_short_id)
        commit.save()

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

    def test_updating_commit_with_existing_grouplink(self):
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

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        commit.message = 'Foo Bar Biz\n\nFixes {}'.format(group.qualified_short_id)
        commit.save()

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).count() == 1

    def test_removes_group_link_when_message_changes(self):
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

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        commit.message = 'no groups here'
        commit.save()

        assert not GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

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

        assert not GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

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

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

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

        assert GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id).exists()

        assert GroupAssignee.objects.filter(group=group, user=user).exists()

        assert Activity.objects.filter(
            project=group.project,
            group=group,
            type=Activity.ASSIGNED,
            user=user,
        )[0].data == {
            'assignee': six.text_type(user.id),
            'assigneeEmail': user.email,
            'assigneeType': 'user',
        }
