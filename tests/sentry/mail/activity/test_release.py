# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core import mail
from django.utils import timezone

from sentry.models import (
    Activity,
    Commit,
    CommitAuthor,
    Deploy,
    Environment,
    GroupSubscriptionReason,
    Release,
    ReleaseCommit,
    Repository,
    UserEmail,
    UserOption,
    UserOptionValue,
)
from sentry.mail.activity.release import ReleaseActivityEmail
from sentry.testutils import TestCase


class ReleaseTestCase(TestCase):
    def setUp(self):
        super(ReleaseTestCase, self).setUp()
        self.user = self.create_user("foo@example.com")

        assert UserEmail.objects.filter(user=self.user, email=self.user.email).update(
            is_verified=True
        )

        self.user2 = self.create_user("bar@example.com")
        assert UserEmail.objects.filter(user=self.user2, email=self.user2.email).update(
            is_verified=True
        )

        self.user3 = self.create_user("baz@example.com")
        assert UserEmail.objects.filter(user=self.user3, email=self.user3.email).update(
            is_verified=True
        )

        self.user4 = self.create_user("floop@example.com")
        assert UserEmail.objects.filter(user=self.user4, email=self.user4.email).update(
            is_verified=True
        )

        self.user5 = self.create_user("companyemail@example.com")
        user5_alt_email = "privateEmail@gmail.com"
        UserEmail.objects.create(email=user5_alt_email, user=self.user5)

        assert UserEmail.objects.filter(user=self.user5, email=self.user5.email).update(
            is_verified=True
        )

        assert UserEmail.objects.filter(user=self.user5, email=user5_alt_email).update(
            is_verified=True
        )

        self.org = self.create_organization(owner=None)
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.create_member(user=self.user, organization=self.org, teams=[self.team])
        self.create_member(user=self.user2, organization=self.org)
        self.create_member(user=self.user3, organization=self.org, teams=[self.team])
        self.create_member(user=self.user4, organization=self.org, teams=[self.team])
        self.create_member(user=self.user5, organization=self.org, teams=[self.team])

        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])
        self.release = Release.objects.create(
            version="a" * 40,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        self.release.add_project(self.project)
        self.release.add_project(self.project2)
        self.environment = Environment.objects.create(
            name="production", organization_id=self.org.id
        )
        self.deploy = Deploy.objects.create(
            release=self.release, organization_id=self.org.id, environment_id=self.environment.id
        )
        repository = Repository.objects.create(organization_id=self.org.id, name=self.project.name)

        self.commit = Commit.objects.create(
            key="a" * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id, name=self.user.name, email=self.user.email
            ),
        )
        self.commit2 = Commit.objects.create(
            key="b" * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id, name=self.user2.name, email=self.user2.email
            ),
        )
        self.commit3 = Commit.objects.create(
            key="c" * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id, name=self.user4.name, email=self.user4.email
            ),
        )
        self.commit4 = Commit.objects.create(
            key="e" * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id, name=self.user5.name, email=user5_alt_email
            ),
        )

        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.commit,
            order=0,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.commit2,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.commit3,
            order=2,
        )

        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.commit4,
            order=3,
        )

        UserOption.objects.set_value(
            user=self.user3,
            organization=self.org,
            key="deploy-emails",
            value=UserOptionValue.all_deploys,
        )

        UserOption.objects.set_value(
            user=self.user4,
            organization=self.org,
            key="deploy-emails",
            value=UserOptionValue.no_deploys,
        )

        # added to make sure org default above takes precedent
        UserOption.objects.set_value(
            user=self.user4,
            organization=None,
            key="deploy-emails",
            value=UserOptionValue.all_deploys,
        )

    def test_simple(self):
        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={"version": self.release.version, "deploy_id": self.deploy.id},
            )
        )
        # user is included because they committed
        # user2 committed but isn't in a team associated with the project.
        # user3 is included because they oped into all deploy emails
        # user4 committed but isn't included because they opted out of all deploy emails
        # for that org -- also tests to make sure org overrides default preference
        # user5 committed with another email address and is still included.

        assert len(email.get_participants()) == 3

        assert email.get_participants() == {
            self.user: GroupSubscriptionReason.committed,
            self.user3: GroupSubscriptionReason.deploy_setting,
            self.user5: GroupSubscriptionReason.committed,
        }

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"][0]["commits"] == [
            (self.commit, self.user),
            (self.commit2, self.user2),
            (self.commit3, self.user4),
            (self.commit4, self.user5),
        ]

        user_context = email.get_user_context(self.user)
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            email.send()

        assert len(mail.outbox) == 3

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {self.user.email, self.user3.email, self.user5.email}

    def test_doesnt_generate_on_no_release(self):
        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={"version": "a", "deploy_id": 5},
            )
        )

        assert email.release is None
        assert not email.should_email()

    def test_no_committers(self):
        release = Release.objects.create(
            version="b" * 40,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        release.add_project(self.project)
        release.add_project(self.project2)
        deploy = Deploy.objects.create(
            release=release, organization_id=self.org.id, environment_id=self.environment.id
        )

        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )

        # only user3 is included because they oped into all deploy emails
        assert len(email.get_participants()) == 1

        assert email.get_participants() == {self.user3: GroupSubscriptionReason.deploy_setting}

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"] == []

        user_context = email.get_user_context(self.user)
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            email.send()

        assert len(mail.outbox) == 1

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {self.user3.email}

    def test_uses_default(self):
        user6 = self.create_user()
        self.create_member(user=user6, organization=self.org, teams=[self.team])

        UserOption.objects.set_value(
            user=user6, organization=None, key="deploy-emails", value=UserOptionValue.all_deploys
        )

        release = Release.objects.create(
            version="b" * 40,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        release.add_project(self.project)
        release.add_project(self.project2)
        deploy = Deploy.objects.create(
            release=release, organization_id=self.org.id, environment_id=self.environment.id
        )

        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )

        # user3 and user 6 are included because they oped into all deploy emails
        # (one on an org level, one as their default)
        assert len(email.get_participants()) == 2

        assert email.get_participants() == {
            user6: GroupSubscriptionReason.deploy_setting,
            self.user3: GroupSubscriptionReason.deploy_setting,
        }

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"] == []

        user_context = email.get_user_context(user6)
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            email.send()

        assert len(mail.outbox) == 2

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {self.user3.email, user6.email}
