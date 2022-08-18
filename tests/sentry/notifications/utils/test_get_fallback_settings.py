from unittest import TestCase

from sentry.models import Project, User
from sentry.notifications.helpers import get_fallback_settings
from sentry.notifications.types import NotificationSettingTypes


class GetFallbackSettingsTest(TestCase):
    def setUp(self) -> None:
        self.user = User(id=1)
        self.project = Project(id=123)

    def test_get_fallback_settings_minimal(self):
        assert get_fallback_settings({NotificationSettingTypes.ISSUE_ALERTS}, {}, {}) == {}

    def test_get_fallback_settings_user(self):
        data = get_fallback_settings({NotificationSettingTypes.ISSUE_ALERTS}, {}, {}, self.user)
        assert data == {
            "alerts": {
                "user": {
                    self.user.id: {
                        "email": "always",
                        "slack": "always",
                        "msteams": "never",
                    }
                }
            }
        }

    def test_get_fallback_settings_projects(self):
        data = get_fallback_settings({NotificationSettingTypes.ISSUE_ALERTS}, {self.project.id}, {})
        assert data == {
            "alerts": {
                "project": {
                    self.project.id: {
                        "email": "default",
                        "slack": "default",
                        "msteams": "default",
                    }
                }
            }
        }
