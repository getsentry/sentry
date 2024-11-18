from django.core import mail

from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import ActivityTestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.users.services.user.service import user_service


class ReleaseTestCase(ActivityTestCase):
    def setUp(self):
        super().setUp()

        self.user5_alt_email = "privateEmail@gmail.com"

        self.org = self.create_organization(owner=None)
        self.org.flags.allow_joinleave = False
        self.org.save()

        self.team = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)

        self.user1 = self.another_user("user1@example.com", self.team)
        self.user2 = self.another_user("user2@example.com")
        self.user3 = self.another_user("user3@example.com", self.team)
        self.user4 = self.another_user("user4@example.com", self.team)
        self.user5 = self.another_user("companyemail@example.com", self.team, self.user5_alt_email)

        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])

        self.environment = Environment.objects.create(
            name="production", organization_id=self.org.id
        )

        self.release, self.deploy = self.another_release("a")

        repository = Repository.objects.create(organization_id=self.org.id, name=self.project.name)

        # The commits are intentionally out of order to test commit `order`.
        self.commit4 = self.another_commit(3, "e", self.user5, repository, self.user5_alt_email)
        self.commit1 = self.another_commit(0, "a", self.user1, repository)
        self.commit2 = self.another_commit(1, "b", self.user2, repository)
        self.commit3 = self.another_commit(2, "c", self.user4, repository)

        with assume_test_silo_mode(SiloMode.CONTROL):
            # added to make sure org default above takes precedent
            NotificationSettingOption.objects.create(
                scope_type=NotificationScopeEnum.ORGANIZATION.value,
                scope_identifier=self.org.id,
                user_id=self.user3.id,
                type=NotificationSettingEnum.DEPLOY.value,
                value=NotificationSettingsOptionEnum.ALWAYS.value,
            )
            NotificationSettingProvider.objects.create(
                scope_type=NotificationScopeEnum.ORGANIZATION.value,
                scope_identifier=self.org.id,
                user_id=self.user3.id,
                type=NotificationSettingEnum.DEPLOY.value,
                provider=ExternalProviderEnum.EMAIL.value,
                value=NotificationSettingsOptionEnum.ALWAYS.value,
            )

            NotificationSettingOption.objects.create(
                scope_type=NotificationScopeEnum.ORGANIZATION.value,
                scope_identifier=self.org.id,
                user_id=self.user4.id,
                type=NotificationSettingEnum.DEPLOY.value,
                value=NotificationSettingsOptionEnum.NEVER.value,
            )
            NotificationSettingProvider.objects.create(
                scope_type=NotificationScopeEnum.ORGANIZATION.value,
                scope_identifier=self.org.id,
                user_id=self.user4.id,
                type=NotificationSettingEnum.DEPLOY.value,
                provider=ExternalProviderEnum.EMAIL.value,
                value=NotificationSettingsOptionEnum.NEVER.value,
            )

            # added to make sure org default above takes precedent
            NotificationSettingOption.objects.create(
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=self.user4.id,
                user_id=self.user4.id,
                type=NotificationSettingEnum.DEPLOY.value,
                value=NotificationSettingsOptionEnum.ALWAYS.value,
            )
            NotificationSettingProvider.objects.create(
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=self.user4.id,
                user_id=self.user4.id,
                type=NotificationSettingEnum.DEPLOY.value,
                provider=ExternalProviderEnum.EMAIL.value,
                value=NotificationSettingsOptionEnum.ALWAYS.value,
            )

    def test_simple(self):
        mail.outbox.clear()
        email = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user_id=self.user1.id,
                type=ActivityType.RELEASE.value,
                data={"version": self.release.version, "deploy_id": self.deploy.id},
            )
        )
        # user1 is included because they committed
        # user2 committed but isn't in a team associated with the project.
        # user3 is included because they oped into all deploy emails
        # user4 committed but isn't included because they opted out of all deploy emails
        # for that org -- also tests to make sure org overrides default preference
        # user5 committed with another email address and is still included.

        participants = (
            email.get_participants_with_group_subscription_reason().get_participants_by_provider(
                ExternalProviders.EMAIL
            )
        )
        assert participants == {
            (Actor.from_orm_user(self.user1), GroupSubscriptionReason.committed),
            (Actor.from_orm_user(self.user3), GroupSubscriptionReason.deploy_setting),
            (Actor.from_orm_user(self.user5), GroupSubscriptionReason.committed),
        }

        context = email.get_context()
        assert context["environment"] == "production"
        rpc_user_5 = user_service.get_user(user_id=self.user5.id)
        assert rpc_user_5 is not None
        assert context["repos"][0]["commits"] == [
            (self.commit4, rpc_user_5.by_email(self.user5_alt_email)),
            (self.commit3, user_service.get_user(user_id=self.user4.id)),
            (self.commit2, user_service.get_user(user_id=self.user2.id)),
            (self.commit1, user_service.get_user(user_id=self.user1.id)),
        ]

        user_context = email.get_recipient_context(Actor.from_orm_user(self.user1), {})
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            email.send()

        assert len(mail.outbox) == 3

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {
            self.user1.email,
            self.user3.email,
            self.user5.email,
        }

    def test_does_not_generate_on_no_release(self):
        email = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user_id=self.user1.id,
                type=ActivityType.RELEASE.value,
                data={"version": "a", "deploy_id": 5},
            )
        )

        assert email.release is None

    def test_no_committers(self):
        mail.outbox.clear()
        Release.objects.all().delete()
        release, deploy = self.another_release("b")

        email = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user_id=self.user1.id,
                type=ActivityType.RELEASE.value,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )

        # only user3 is included because they opted into all deploy emails
        participants = (
            email.get_participants_with_group_subscription_reason().get_participants_by_provider(
                ExternalProviders.EMAIL
            )
        )
        assert participants == {
            (Actor.from_orm_user(self.user3), GroupSubscriptionReason.deploy_setting)
        }

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"] == []

        user_context = email.get_recipient_context(Actor.from_orm_user(self.user1), {})
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

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=user6.id,
                user_id=user6.id,
                type=NotificationSettingEnum.DEPLOY.value,
                value=NotificationSettingsOptionEnum.ALWAYS.value,
            )

        release, deploy = self.another_release("b")

        email = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user_id=self.user1.id,
                type=ActivityType.RELEASE.value,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )
        mail.outbox.clear()
        # user3 and user 6 are included because they oped into all deploy emails
        # (one on an org level, one as their default)
        participants = (
            email.get_participants_with_group_subscription_reason().get_participants_by_provider(
                ExternalProviders.EMAIL
            )
        )
        assert len(participants) == 2
        assert participants == {
            (Actor.from_orm_user(user6), GroupSubscriptionReason.deploy_setting),
            (Actor.from_orm_user(self.user3), GroupSubscriptionReason.deploy_setting),
        }

        context = email.get_context()
        assert context["environment"] == "production"
        assert context["repos"] == []

        user_context = email.get_recipient_context(Actor.from_orm_user(user6), {})
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            email.send()

        assert len(mail.outbox) == 2

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {self.user3.email, user6.email}
