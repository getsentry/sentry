from datetime import timedelta

from django.test.utils import override_settings
from django.utils import timezone

from sentry.models import ExternalActor, Integration, NotificationSetting, Team, User
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils.cases import TestMigrations
from sentry.types.integrations import ExternalProviders

SETTINGS_TO_BACKFILL = [
    NotificationSettingTypes.DEPLOY,
    NotificationSettingTypes.ISSUE_ALERTS,
    NotificationSettingTypes.WORKFLOW,
]


def get_scope_type_from_entity(entity):
    if isinstance(entity, User):
        return NotificationScopeType.USER
    if isinstance(entity, Team):
        return NotificationScopeType.TEAM
    raise Exception("Invalid type")


START_DATE_DEFAULT_SLACK_NOTIFICATION = timezone.now() - timedelta(days=7)
DEFAULT_JOIN_DATE = START_DATE_DEFAULT_SLACK_NOTIFICATION - timedelta(days=1)


@override_settings(START_DATE_DEFAULT_SLACK_NOTIFICATION=START_DATE_DEFAULT_SLACK_NOTIFICATION)
class TestBackfill(TestMigrations):
    migrate_from = "0310_sentry_functions_add_webhooks"
    migrate_to = "0311_backfill_slack_settings"

    def setup_before_migration(self, apps):
        self.slack_integration = Integration(
            provider="slack",
            external_id="1",
            name="Team 1",
        )
        self.github_integration = Integration(
            provider="github",
            external_id="3",
            name="Team 1",
        )
        self.slack_integration.save()
        self.user1 = self.create_user(date_joined=DEFAULT_JOIN_DATE)
        self.user2 = self.create_user(date_joined=DEFAULT_JOIN_DATE)
        self.user3 = self.create_user(date_joined=DEFAULT_JOIN_DATE)
        self.user4 = self.create_user(
            date_joined=START_DATE_DEFAULT_SLACK_NOTIFICATION + timedelta(days=1)
        )
        self.user5 = self.create_user(date_joined=DEFAULT_JOIN_DATE)
        self.orgA = self.create_organization(owner=self.user1)
        self.orgB = self.create_organization(owner=self.user5)
        self.slack_integration.add_organization(self.orgA)
        self.github_integration.add_organization(self.orgB)
        self.teamA_1 = self.create_team(
            organization=self.orgA, members=[self.user1, self.user2, self.user3, self.user4]
        )
        self.teamA_2 = self.create_team(organization=self.orgA)
        self.teamA_3 = self.create_team(organization=self.orgA)
        self.projectA_1 = self.create_project(
            organization=self.orgA, teams=[self.teamA_1, self.teamA_2, self.teamA_3]
        )
        # setup identities and providers
        slack_provider = self.create_identity_provider(self.slack_integration)
        # skip user 3 intentionally
        for user in [self.user1, self.user2, self.user4]:
            self.create_identity(
                user=user, identity_provider=slack_provider, external_id=str(user.id) + "stuff"
            )
        ExternalActor.objects.create(
            actor=self.teamA_2.actor,
            organization=self.orgA,
            integration=self.slack_integration,
            provider=ExternalProviders.SLACK.value,
            external_name="test",
        )

        github_provider = self.create_identity_provider(self.github_integration)
        # make a Github identity
        self.create_identity(
            user=self.user5,
            identity_provider=github_provider,
            external_id=str(self.user5.id) + "stuff",
        )

        # populate settings

        # user2 should have one always setting and one default setting
        NotificationSetting.objects.create(
            scope_type=NotificationScopeType.USER.value,
            target_id=self.user2.actor_id,
            provider=ExternalProviders.SLACK.value,
            type=NotificationSettingTypes.ISSUE_ALERTS.value,
            scope_identifier=self.user2.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        )

        # default should be wiped out
        NotificationSetting.objects.create(
            scope_type=NotificationScopeType.USER.value,
            target_id=self.user2.actor_id,
            provider=ExternalProviders.SLACK.value,
            type=NotificationSettingTypes.WORKFLOW.value,
            scope_identifier=self.user2.id,
            value=NotificationSettingOptionValues.DEFAULT.value,
        )

        # teamA_2 is like user 2
        NotificationSetting.objects.create(
            scope_type=NotificationScopeType.TEAM.value,
            target_id=self.teamA_2.actor_id,
            provider=ExternalProviders.SLACK.value,
            type=NotificationSettingTypes.ISSUE_ALERTS.value,
            scope_identifier=self.teamA_2.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        )

        # a default to overwrite
        NotificationSetting.objects.create(
            scope_type=NotificationScopeType.TEAM.value,
            target_id=self.teamA_2.actor_id,
            provider=ExternalProviders.SLACK.value,
            type=NotificationSettingTypes.WORKFLOW.value,
            scope_identifier=self.teamA_2.id,
            value=NotificationSettingOptionValues.DEFAULT.value,
        )

    def test(self):
        # user 1 gets full backfill
        for notification_type in SETTINGS_TO_BACKFILL:
            assert NotificationSetting.objects.filter(
                scope_type=NotificationScopeType.USER.value,
                target_id=self.user1.actor_id,
                provider=ExternalProviders.SLACK.value,
                type=notification_type.value,
                scope_identifier=self.user1.id,
                value=NotificationSettingOptionValues.NEVER.value,
            ).exists()

        # no backfill for other settings
        assert not NotificationSetting.objects.filter(
            target_id=self.user1.actor_id,
            type=NotificationSettingTypes.APPROVAL.value,
        ).exists()

        # user2 and teamA_2 gets partial backfill
        for item_with_actor in [self.user2, self.teamA_2]:
            for notification_type in SETTINGS_TO_BACKFILL:
                scope_type = get_scope_type_from_entity(item_with_actor)

                # honor the current value of always for issue alerts
                value = (
                    NotificationSettingOptionValues.ALWAYS.value
                    if notification_type == NotificationSettingTypes.ISSUE_ALERTS
                    else NotificationSettingOptionValues.NEVER.value
                )
                assert NotificationSetting.objects.filter(
                    scope_type=scope_type.value,
                    target_id=item_with_actor.actor_id,
                    provider=ExternalProviders.SLACK.value,
                    type=notification_type.value,
                    scope_identifier=item_with_actor.id,
                    value=value,
                ).exists()

        # user3 has no identity and shouldn't be backfilled
        assert not NotificationSetting.objects.filter(
            target_id=self.user3.actor_id,
        ).exists()

        # user4 joined after the start date and shouldn't be backfilled
        assert not NotificationSetting.objects.filter(
            target_id=self.user4.actor_id,
        ).exists()

        # user5 only has a Github identity
        assert not NotificationSetting.objects.filter(
            target_id=self.user4.actor_id,
        ).exists()

        # teamA_3 has no ExternalActor so we don't need to update
        assert not NotificationSetting.objects.filter(
            target_id=self.teamA_3.actor_id,
        ).exists()
