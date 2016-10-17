# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core import mail
from django.utils import timezone

from sentry.models import (
    Activity, Commit, CommitAuthor, GroupSubscriptionReason, Release,
    ReleaseCommit, Repository, UserEmail
)
from sentry.plugins.sentry_mail.activity.release import ReleaseActivityEmail
from sentry.testutils import TestCase


class ReleaseTestCase(TestCase):
    def setUp(self):
        super(ReleaseTestCase, self).setUp()
        self.user = self.create_user('foo@example.com')
        assert UserEmail.objects.filter(
            user=self.user,
            email=self.user.email,
        ).update(
            is_verified=True,
        )
        self.user2 = self.create_user('bar@example.com')
        assert UserEmail.objects.filter(
            user=self.user2,
            email=self.user2.email,
        ).update(
            is_verified=True,
        )
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.create_member(user=self.user, organization=self.org, teams=[self.team])
        self.create_member(user=self.user2, organization=self.org)
        self.project = self.create_project(
            organization=self.org,
            team=self.team,
        )
        self.release = Release.objects.create(
            version='a' * 40,
            project_id=self.project.id,
            date_released=timezone.now(),
        )
        repository = Repository.objects.create(
            organization_id=self.org.id,
            name=self.project.name,
        )
        self.commit = Commit.objects.create(
            key='a' * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id,
                name=self.user.name,
                email=self.user.email,
            ),
        )
        self.commit2 = Commit.objects.create(
            key='b' * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id,
                name=self.user2.name,
                email=self.user2.email,
            )
        )
        ReleaseCommit.objects.create(
            project_id=self.project.id,
            release=self.release,
            commit=self.commit,
            order=0,
        )
        ReleaseCommit.objects.create(
            project_id=self.project.id,
            release=self.release,
            commit=self.commit2,
            order=1,
        )

    def test_simple(self):
        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={'version': self.release.version},
            )
        )

        with self.feature('workflow:release-emails'):
            assert email.get_participants() == {
                self.user: GroupSubscriptionReason.committed,
            }

            context = email.get_context()
            assert context['commit_list'] == [self.commit, self.commit2]

            with self.tasks():
                email.send()

            assert len(mail.outbox) == 1
            msg = mail.outbox[-1]
            assert msg.to == [self.user.email]

    def test_doesnt_generate_on_no_release(self):
        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={'version': 'a'},
            )
        )

        assert email.release is None
        assert not email.should_email()
