import pytest

from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications.service import notifications_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import ExternalProviders


class DummyRoleBasedRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self):
        return OrganizationMember.objects.filter(organization=self.organization)


class DummyRequestNotification(OrganizationRequestNotification):
    metrics_key = "dummy"
    template_path = ""
    RoleBasedRecipientStrategyClass = DummyRoleBasedRecipientStrategy


@region_silo_test(stable=True)
class GetParticipantsTest(TestCase):
    def setUp(self):
        self.user2 = self.create_user()
        self.create_member(user=self.user2, organization=self.organization)
        self.user_actors = {RpcActor.from_orm_user(user) for user in (self.user, self.user2)}

    def test_default_to_slack(self):
        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: self.user_actors,
            ExternalProviders.SLACK: self.user_actors,
        }

    def test_turn_off_settings(self):
        notifications_service.update_settings(
            external_provider=ExternalProviders.SLACK,
            notification_type=NotificationSettingTypes.APPROVAL,
            setting_option=NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor(id=self.user.id, actor_type=ActorType.USER),
        )
        notifications_service.update_settings(
            external_provider=ExternalProviders.EMAIL,
            notification_type=NotificationSettingTypes.APPROVAL,
            setting_option=NotificationSettingOptionValues.ALWAYS,
            actor=RpcActor(id=self.user2.id, actor_type=ActorType.USER),
        )

        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: self.user_actors,
            ExternalProviders.SLACK: self.user_actors,
        }

    def test_build_notification_footer(self):
        actor = RpcActor(id=self.user.id, actor_type=ActorType.USER)
        notification = DummyRequestNotification(self.organization, self.user)
        query_params = f"?referrer={notification.metrics_key}-slack-user&notification_uuid={notification.notification_uuid}"
        url = str(
            self.organization.absolute_url(
                "/settings/account/notifications/approval/", query=query_params
            )
        )
        assert (
            notification.build_notification_footer(actor, ExternalProviders.SLACK)
            == f"You are receiving this notification because you're listed as an organization Member | <{url}|Notification Settings>"
        )

    def test_build_notification_footer_for_team(self):
        actor = RpcActor(id=self.team.id, actor_type=ActorType.TEAM)
        notification = DummyRequestNotification(self.organization, self.user)
        with pytest.raises(NotImplementedError):
            notification.build_notification_footer(actor, ExternalProviders.SLACK)

    @with_feature("organizations:team-workflow-notifications")
    def test_team_recipient_gets_team_settings_link(self):
        actor = RpcActor(id=self.team.id, actor_type=ActorType.TEAM, slug=self.team.slug)
        notification = DummyRequestNotification(self.organization, self.user)
        query_params = f"?referrer={notification.metrics_key}-slack-team&notification_uuid={notification.notification_uuid}"
        url = str(
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/teams/{self.team.slug}/notifications/",
                query=query_params,
            )
        )
        assert (
            notification.build_notification_footer(actor, ExternalProviders.SLACK)
            == f"You are receiving this notification because you're listed as an organization Member | <{url}|Notification Settings>"
        )
