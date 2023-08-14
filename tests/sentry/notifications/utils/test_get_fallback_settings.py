from sentry.notifications.helpers import get_fallback_settings
from sentry.notifications.types import NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test(stable=True)
class GetFallbackSettingsTest(TestCase):
    def setUp(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            self.user = RpcActor.from_orm_user(self.create_user())
        self.project = self.create_project()

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
