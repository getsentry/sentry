from unittest import TestCase

from sentry.models import Project, User
from sentry.notifications.helpers import has_any_non_never_settings
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders


class HasAnyNonNeverSettingsTestCase(TestCase):
    def setUp(self) -> None:
        self.user = User(id=1)
        self.project = Project(id=1)

    def test_empty(self):
        """Should fall back to defaults for EMAIL and SLACK."""
        assert has_any_non_never_settings(
            notification_settings_by_scope={},
            recipient=self.user,
            parent_id=self.project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )

    def test_user_scope_only(self):
        notification_settings_by_scope = {
            NotificationScopeType.USER: {
                self.user.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            },
        }
        assert has_any_non_never_settings(
            notification_settings_by_scope,
            recipient=self.user,
            parent_id=self.project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )

    def test_parent_scope_only(self):
        notification_settings_by_scope = {
            NotificationScopeType.PROJECT: {
                self.project.id: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                },
            },
        }
        assert has_any_non_never_settings(
            notification_settings_by_scope,
            recipient=self.user,
            parent_id=self.project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )

    def test_all_never(self):
        notification_settings_by_scope = {
            NotificationScopeType.USER: {
                self.user.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            },
            NotificationScopeType.PROJECT: {
                self.project.id: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            },
        }
        assert not has_any_non_never_settings(
            notification_settings_by_scope,
            recipient=self.user,
            parent_id=self.project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )

    def test_mismatched_scopes(self):
        notification_settings_by_scope = {
            NotificationScopeType.USER: {
                self.user.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            },
            NotificationScopeType.PROJECT: {
                self.project.id: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            },
        }
        assert has_any_non_never_settings(
            notification_settings_by_scope,
            recipient=self.user,
            parent_id=self.project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )
