from unittest import mock

from sentry.roles import default_manager
from sentry.roles.manager import RoleManager


def _assert_minimum_team_role_is(manager: RoleManager, org_role: str, team_role: str) -> None:
    assert manager.get_minimum_team_role(org_role).id == team_role


TEST_ORG_ROLES = [
    {"id": "peasant", "name": "Peasant", "desc": "Poor farmer"},
    {"id": "baron", "name": "Baron", "desc": "Lowest of nobility"},
    {"id": "earl", "name": "Earl", "desc": "Middle of nobility"},
    {"id": "duke", "name": "Duke", "desc": "Highest of nobility"},
    {"id": "monarch", "name": "Monarch", "desc": "Ruler of all"},
]

TEST_TEAM_ROLES = [
    {
        "id": "private",
        "name": "Private",
        "is_minimum_role_for": "peasant",
        "desc": "Lowest rank in the army",
    },
    {
        "id": "sergeant",
        "name": "Sergeant",
        "is_minimum_role_for": "earl",
        "desc": "Low officer class",
    },
    {"id": "lieutenant", "name": "Lieutenant", "desc": "Leads platoons and companies"},
    {
        "id": "captain",
        "name": "Captain",
        "is_minimum_role_for": "monarch",
        "desc": "Commands big groups",
    },
]


def test_default_manager() -> None:
    assert default_manager.get_all()
    assert len(default_manager.get_choices()) == len(default_manager.get_all())
    assert default_manager.get_top_dog().id == "owner"

    assert default_manager.can_manage("owner", "manager")
    assert default_manager.can_manage("owner", "member")
    assert default_manager.can_manage("manager", "member")

    _assert_minimum_team_role_is(default_manager, "member", "contributor")
    _assert_minimum_team_role_is(default_manager, "admin", "admin")
    _assert_minimum_team_role_is(default_manager, "manager", "admin")
    _assert_minimum_team_role_is(default_manager, "owner", "admin")


def test_priority() -> None:
    manager = RoleManager(TEST_ORG_ROLES, TEST_TEAM_ROLES)

    assert len(manager.get_all()) == len(TEST_ORG_ROLES)
    assert manager.can_manage("duke", "baron")
    assert manager.get_default().id == "peasant"
    assert manager.get_top_dog().id == "monarch"

    assert len(manager.get_all()) == 5
    assert manager.can_manage("duke", "baron")
    assert manager.get_default().id == "peasant"
    assert manager.get_top_dog().id == "monarch"


def test_mapping() -> None:
    manager = RoleManager(TEST_ORG_ROLES, TEST_TEAM_ROLES)

    _assert_minimum_team_role_is(manager, "monarch", "captain")
    _assert_minimum_team_role_is(manager, "duke", "sergeant")
    _assert_minimum_team_role_is(manager, "earl", "sergeant")
    _assert_minimum_team_role_is(manager, "baron", "private")
    _assert_minimum_team_role_is(manager, "peasant", "private")


def test_choices() -> None:
    manager = RoleManager(TEST_ORG_ROLES, TEST_TEAM_ROLES)

    assert manager.get_choices() == manager.organization_roles.get_choices()
    assert manager.team_roles.get_choices() == tuple(
        (role["id"], role["name"]) for role in TEST_TEAM_ROLES
    )


def test_descriptions() -> None:
    manager = RoleManager(TEST_ORG_ROLES, TEST_TEAM_ROLES)

    assert manager.team_roles.get_descriptions() == tuple(
        (role["id"], role["desc"]) for role in TEST_TEAM_ROLES
    )


def test_team_default_mapping() -> None:
    # Check that RoleManager provides sensible defaults in case the team roles
    # don't specify any mappings

    team_roles = [
        {k: v for (k, v) in role.items() if k != "is_minimum_role_for"} for role in TEST_TEAM_ROLES
    ]
    manager = RoleManager(TEST_ORG_ROLES, team_roles)

    _assert_minimum_team_role_is(manager, "monarch", "captain")
    _assert_minimum_team_role_is(manager, "duke", "private")
    _assert_minimum_team_role_is(manager, "earl", "private")
    _assert_minimum_team_role_is(manager, "baron", "private")
    _assert_minimum_team_role_is(manager, "peasant", "private")


def test_top_dog_accesses_all_team_roles() -> None:
    # Check that the org's top dog role has access to the top team role even if
    # it's explicitly mapped to a lower role

    team_roles = [
        {"id": "private", "name": "Private", "is_minimum_role_for": "peasant", "desc": "fee"},
        {"id": "sergeant", "name": "Sergeant", "is_minimum_role_for": "earl", "desc": "fi"},
        {
            "id": "lieutenant",
            "name": "Lieutenant",
            "is_minimum_role_for": "monarch",
            "desc": "fo",
        },
        {"id": "captain", "name": "Captain", "desc": "fum"},
    ]
    manager = RoleManager(TEST_ORG_ROLES, team_roles)

    _assert_minimum_team_role_is(manager, "monarch", "captain")
    _assert_minimum_team_role_is(manager, "duke", "sergeant")
    _assert_minimum_team_role_is(manager, "earl", "sergeant")
    _assert_minimum_team_role_is(manager, "baron", "private")
    _assert_minimum_team_role_is(manager, "peasant", "private")


def test_if_team_top_dog_is_not_org_top_dog() -> None:
    team_roles = [
        {"id": "private", "name": "Private", "is_minimum_role_for": "peasant", "desc": "fee"},
        {"id": "sergeant", "name": "Sergeant", "is_minimum_role_for": "earl", "desc": "fi"},
        {"id": "lieutenant", "name": "Lieutenant", "desc": "fo"},
        {"id": "captain", "name": "Captain", "is_minimum_role_for": "duke", "desc": "fum"},
    ]
    manager = RoleManager(TEST_ORG_ROLES, team_roles)

    _assert_minimum_team_role_is(manager, "monarch", "captain")
    _assert_minimum_team_role_is(manager, "duke", "captain")
    _assert_minimum_team_role_is(manager, "earl", "sergeant")
    _assert_minimum_team_role_is(manager, "baron", "private")
    _assert_minimum_team_role_is(manager, "peasant", "private")


def test_handles_non_injective_mapping() -> None:
    # Check that RoleManager tolerates multiple team roles pointing at the same
    # org role and maps to the highest one

    team_roles = [
        {"id": "private", "name": "Private", "is_minimum_role_for": "peasant", "desc": "fee"},
        {"id": "sergeant", "name": "Sergeant", "is_minimum_role_for": "earl", "desc": "fi"},
        {"id": "lieutenant", "name": "Lieutenant", "is_minimum_role_for": "earl", "desc": "fo"},
        {"id": "captain", "name": "Captain", "is_minimum_role_for": "monarch", "desc": "fum"},
    ]
    manager = RoleManager(TEST_ORG_ROLES, team_roles)

    _assert_minimum_team_role_is(manager, "monarch", "captain")
    _assert_minimum_team_role_is(manager, "duke", "lieutenant")
    _assert_minimum_team_role_is(manager, "earl", "lieutenant")
    _assert_minimum_team_role_is(manager, "baron", "private")
    _assert_minimum_team_role_is(manager, "peasant", "private")


@mock.patch("sentry.roles.manager.warnings")
def test_team_mapping_to_legacy_roles(mock_warnings: mock.MagicMock) -> None:
    # Check that RoleManager provides sensible defaults in case the default org
    # roles have been overridden by unfamiliar values, leaving behind default
    # team roles with mapping keys that point to nothing

    legacy_roles = [
        {"id": "legionary", "name": "Legionary", "desc": "Member of a legion"},
        {"id": "centurion", "name": "Centurion", "desc": "Commander of a military unit"},
        {"id": "legate", "name": "Legate", "desc": "Commander of a legion"},
    ]
    manager = RoleManager(legacy_roles, TEST_TEAM_ROLES)

    assert mock_warnings.warn.called

    _assert_minimum_team_role_is(manager, "legate", "captain")
    _assert_minimum_team_role_is(manager, "centurion", "private")
    _assert_minimum_team_role_is(manager, "legionary", "private")
