from django.core import mail
from django.utils import timezone

from sentry.models import (
    Activity,
    Commit,
    CommitAuthor,
    Deploy,
    Environment,
    GroupSubscriptionReason,
    NotificationSetting,
    Release,
    ReleaseCommit,
    Repository,
    UserEmail,
)
from sentry.mail.activity.release import ReleaseActivityEmail
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.testutils import TestCase


class ReleaseTestCase(TestCase):
    def another_user(self, email_string, team=None, alt_email_string=None):
        user = self.create_user(email_string)
        if alt_email_string:
            UserEmail.objects.create(email=alt_email_string, user=user)

            assert UserEmail.objects.filter(user=user, email=alt_email_string).update(
                is_verified=True
            )

        assert UserEmail.objects.filter(user=user, email=user.email).update(is_verified=True)

        self.create_member(user=user, organization=self.org, teams=[team] if team else None)

        return user

    def another_commit(self, order, name, user, repository, alt_email_string=None):
        commit = Commit.objects.create(
            key=name * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id,
                name=user.name,
                email=alt_email_string or user.email,
            ),
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit,
            order=order,
        )

        return commit

    def another_release(self, name):
        release = Release.objects.create(
            version=name * 40,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        release.add_project(self.project)
        release.add_project(self.project2)
        deploy = Deploy.objects.create(
            release=release, organization_id=self.org.id, environment_id=self.environment.id
        )

        return release, deploy

    def setUp(self):
        super().setUp()

        user5_alt_email = "privateEmail@gmail.com"

        self.org = self.create_organization(owner=None)
        self.org.flags.allow_joinleave = False
        self.org.save()

        self.team = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)

        self.user1 = self.another_user("user1@example.com", self.team)
        self.user2 = self.another_user("user2@example.com")
        self.user3 = self.another_user("user3@example.com", self.team)
        self.user4 = self.another_user("user4@example.com", self.team)
        self.user5 = self.another_user("companyemail@example.com", self.team, user5_alt_email)

        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])

        self.environment = Environment.objects.create(
            name="production", organization_id=self.org.id
        )

        self.release, self.deploy = self.another_release("a")

        repository = Repository.objects.create(organization_id=self.org.id, name=self.project.name)

        self.commit1 = self.another_commit(0, "a", self.user1, repository)
        self.commit2 = self.another_commit(1, "b", self.user2, repository)
        self.commit3 = self.another_commit(2, "c", self.user4, repository)
        self.commit4 = self.another_commit(3, "e", self.user5, repository, user5_alt_email)

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user3,
            organization=self.org,
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.NEVER,
            user=self.user4,
            organization=self.org,
        )

        # added to make sure org default above takes precedent
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user4,
        )

    def test_simple(self):
        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user1,
                type=Activity.RELEASE,
                data={"version": self.release.version, "deploy_id": self.deploy.id},
            )
        )
        # user1 is included because they committed
        # user2 committed but isn't in a team associated with the project.
        # user3 is included because they oped into all deploy emails
        # user4 committed but isn't included because they opted out of all deploy emails
        # for that org -- also tests to make sure org overrides default preference
        # user5 committed with another email address and is still included.

        assert len(email.get_participants()) == 3

        assert email.get_participants() == {
            self.user1: GroupSubscriptionReason.committed,
            self.user3: GroupSubscriptionReason.deploy_setting,
            self.user5: GroupSubscriptionReason.committed,
        }

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"][0]["commits"] == [
            (self.commit1, self.user1),
            (self.commit2, self.user2),
            (self.commit3, self.user4),
            (self.commit4, self.user5),
        ]

        user_context = email.get_user_context(self.user1)
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            email.send()

        assert len(mail.outbox) == 3

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {self.user1.email, self.user3.email, self.user5.email}

    def test_does_not_generate_on_no_release(self):
        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user1,
                type=Activity.RELEASE,
                data={"version": "a", "deploy_id": 5},
            )
        )

        assert email.release is None
        assert not email.should_email()

    def test_no_committers(self):
        release, deploy = self.another_release("b")

        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user1,
                type=Activity.RELEASE,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )

        # only user3 is included because they opted into all deploy emails
        assert len(email.get_participants()) == 1

        assert email.get_participants() == {self.user3: GroupSubscriptionReason.deploy_setting}

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"] == []

        user_context = email.get_user_context(self.user1)
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

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=user6,
        )
        release, deploy = self.another_release("b")

        email = ReleaseActivityEmail(
            Activity(
                project=self.project,
                user=self.user1,
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
