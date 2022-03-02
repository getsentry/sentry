from unittest import mock

from sentry.roles import RoleManager, default_manager
from sentry.testutils import TestCase


class RoleManagerTest(TestCase):
    @staticmethod
    def _assert_mapping(manager: RoleManager, org_role: str, team_role: str) -> None:
        assert manager.get_base_team_role(org_role).id == team_role

    def test_default_manager(self):
        assert default_manager.get_all()
        assert len(default_manager.get_choices()) == len(default_manager.get_all())
        assert default_manager.get_top_dog().id == "owner"

        self._assert_mapping(default_manager, "member", "contributor")
        self._assert_mapping(default_manager, "admin", "admin")
        self._assert_mapping(default_manager, "manager", "admin")
        self._assert_mapping(default_manager, "owner", "admin")

    TEST_ORG_ROLES = [
        {"id": "peasant", "name": "Peasant"},
        {"id": "baron", "name": "Baron"},
        {"id": "earl", "name": "Earl"},
        {"id": "duke", "name": "Duke"},
        {"id": "monarch", "name": "Monarch"},
    ]

    TEST_TEAM_ROLES = [
        {"id": "private", "name": "Private", "mapped_to": "peasant"},
        {"id": "sergeant", "name": "Sergeant", "mapped_to": "earl"},
        {"id": "lieutenant", "name": "Lieutenant"},
        {"id": "captain", "name": "Captain", "mapped_to": "monarch"},
    ]

    def test_priority(self):
        manager = RoleManager(self.TEST_ORG_ROLES, self.TEST_TEAM_ROLES)
        assert len(manager.get_all()) == 5
        assert manager.can_manage("duke", "baron")
        assert manager.get_default().id == "peasant"
        assert manager.get_top_dog().id == "monarch"

    def test_mapping(self):
        manager = RoleManager(self.TEST_ORG_ROLES, self.TEST_TEAM_ROLES)

        self._assert_mapping(manager, "monarch", "captain")
        self._assert_mapping(manager, "duke", "sergeant")
        self._assert_mapping(manager, "earl", "sergeant")
        self._assert_mapping(manager, "baron", "private")
        self._assert_mapping(manager, "peasant", "private")

    def test_team_default_mapping(self):
        # Check that RoleManager provides sensible defaults in case the team roles
        # don't specify any mappings

        team_roles = [
            {k: v for (k, v) in role.items() if k != "mapped_to"} for role in self.TEST_TEAM_ROLES
        ]
        manager = RoleManager(self.TEST_ORG_ROLES, team_roles)

        self._assert_mapping(manager, "monarch", "captain")
        self._assert_mapping(manager, "duke", "private")
        self._assert_mapping(manager, "earl", "private")
        self._assert_mapping(manager, "baron", "private")
        self._assert_mapping(manager, "peasant", "private")

    def test_top_dog_accesses_all_team_roles(self):
        # Check that the org's top dog role has access to the top team role even if
        # it's explicitly mapped to a lower role

        team_roles = [
            {"id": "private", "name": "Private", "mapped_to": "peasant"},
            {"id": "sergeant", "name": "Sergeant", "mapped_to": "earl"},
            {"id": "lieutenant", "name": "Lieutenant", "mapped_to": "monarch"},
            {"id": "captain", "name": "Captain"},
        ]
        manager = RoleManager(self.TEST_ORG_ROLES, team_roles)

        self._assert_mapping(manager, "monarch", "captain")
        self._assert_mapping(manager, "duke", "sergeant")
        self._assert_mapping(manager, "earl", "sergeant")
        self._assert_mapping(manager, "baron", "private")
        self._assert_mapping(manager, "peasant", "private")

    def test_if_team_top_dog_is_not_org_top_dog(self):
        team_roles = [
            {"id": "private", "name": "Private", "mapped_to": "peasant"},
            {"id": "sergeant", "name": "Sergeant", "mapped_to": "earl"},
            {"id": "lieutenant", "name": "Lieutenant"},
            {"id": "captain", "name": "Captain", "mapped_to": "duke"},
        ]
        manager = RoleManager(self.TEST_ORG_ROLES, team_roles)

        self._assert_mapping(manager, "monarch", "captain")
        self._assert_mapping(manager, "duke", "captain")
        self._assert_mapping(manager, "earl", "sergeant")
        self._assert_mapping(manager, "baron", "private")
        self._assert_mapping(manager, "peasant", "private")

    def test_handles_non_injective_mapping(self):
        # Check that RoleManager tolerates multiple team roles pointing at the same
        # org role and maps to the highest one

        team_roles = [
            {"id": "private", "name": "Private", "mapped_to": "peasant"},
            {"id": "sergeant", "name": "Sergeant", "mapped_to": "earl"},
            {"id": "lieutenant", "name": "Lieutenant", "mapped_to": "earl"},
            {"id": "captain", "name": "Captain", "mapped_to": "monarch"},
        ]
        manager = RoleManager(self.TEST_ORG_ROLES, team_roles)

        self._assert_mapping(manager, "monarch", "captain")
        self._assert_mapping(manager, "duke", "lieutenant")
        self._assert_mapping(manager, "earl", "lieutenant")
        self._assert_mapping(manager, "baron", "private")
        self._assert_mapping(manager, "peasant", "private")

    @mock.patch("sentry.roles.manager.warnings")
    def test_team_mapping_to_legacy_roles(self, mock_warnings):
        # Check that RoleManager provides sensible defaults in case the default org
        # roles have been overridden by unfamiliar values, leaving behind default
        # team roles that with mapping keys that point to nothing

        legacy_roles = [
            {"id": "legionary", "name": "Legionary"},
            {"id": "centurion", "name": "Centurion"},
            {"id": "legate", "name": "Legate"},
        ]
        manager = RoleManager(legacy_roles, self.TEST_TEAM_ROLES)

        assert mock_warnings.warn.called

        self._assert_mapping(manager, "legate", "captain")
        self._assert_mapping(manager, "centurion", "private")
        self._assert_mapping(manager, "legionary", "private")
