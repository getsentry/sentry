import pytest

from sentry.models.actor import ACTOR_TYPES, Actor
from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils.cases import TestMigrations
from sentry.types.integrations import ExternalProviders


@pytest.mark.skip("Test setup no longer valid after adding notification_team_or_user_check")
class BackfillNotificationSettingTest(TestMigrations):
    migrate_from = "0438_break_inviter_fk_organizationmember"
    migrate_to = "0439_backfill_notificationsetting"

    def setup_initial_state(self):
        actor, _ = Actor.objects.get_or_create(user_id=self.user.id, type=ACTOR_TYPES["user"])
        self.valid_user = NotificationSetting.objects.create(
            scope_type=NotificationScopeType.USER.value,
            scope_identifier=0,
            provider=ExternalProviders.EMAIL.value,
            type=NotificationSettingTypes.DEPLOY.value,
            target_id=actor.id,
            user_id=self.user.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        )
        team = self.create_team(organization=self.organization)
        team_actor, _ = Actor.objects.get_or_create(team_id=team.id, type=ACTOR_TYPES["team"])
        self.valid_team = NotificationSetting.objects.create(
            scope_type=NotificationScopeType.TEAM.value,
            scope_identifier=0,
            provider=ExternalProviders.EMAIL.value,
            type=NotificationSettingTypes.DEPLOY.value,
            target_id=team_actor.id,
            team_id=team.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        )

        self.other_user = self.create_user()
        other_actor, _ = Actor.objects.get_or_create(
            user_id=self.other_user.id, type=ACTOR_TYPES["user"]
        )
        self.invalid_user = NotificationSetting.objects.create(
            scope_type=NotificationScopeType.USER.value,
            scope_identifier=0,
            provider=ExternalProviders.EMAIL.value,
            type=NotificationSettingTypes.DEPLOY.value,
            target_id=other_actor.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        )

        self.other_team = self.create_team(organization=self.organization)
        other_team_actor, _ = Actor.objects.get_or_create(
            team_id=self.other_team.id, type=ACTOR_TYPES["team"]
        )
        self.invalid_team = NotificationSetting.objects.create(
            scope_type=NotificationScopeType.TEAM.value,
            scope_identifier=0,
            provider=ExternalProviders.EMAIL.value,
            type=NotificationSettingTypes.DEPLOY.value,
            target_id=other_team_actor.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        )

    def test(self):
        self.invalid_user.refresh_from_db()
        self.invalid_team.refresh_from_db()

        assert self.invalid_user.user_id == self.other_user.id
        assert self.invalid_user.team_id is None

        assert self.invalid_team.team_id == self.other_team.id
        assert self.invalid_team.user_id is None
