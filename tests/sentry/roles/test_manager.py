from sentry.roles import RoleManager, default_manager
from sentry.testutils import TestCase


class RoleManagerTest(TestCase):
    def test_default_manager(self):
        assert default_manager.get_all()
        assert len(default_manager.get_choices()) == len(default_manager.get_all())
        assert default_manager.get_top_dog().id == "owner"

        assert default_manager.can_manage("owner", "manager")
        assert default_manager.can_manage("owner", "member")
        assert default_manager.can_manage("manager", "member")

    TEST_ORG_ROLES = [
        {"id": "peasant", "name": "Peasant"},
        {"id": "baron", "name": "Baron"},
        {"id": "earl", "name": "Earl"},
        {"id": "duke", "name": "Duke"},
        {"id": "monarch", "name": "Monarch"},
    ]

    def test_priority(self):
        manager = RoleManager(self.TEST_ORG_ROLES)
        assert len(manager.get_all()) == len(self.TEST_ORG_ROLES)
        assert manager.can_manage("duke", "baron")
        assert manager.get_default().id == "peasant"
        assert manager.get_top_dog().id == "monarch"
