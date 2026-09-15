from __future__ import annotations

from typing import Any

from sentry.apidocs.examples import world
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.examples.organization_member_examples import (
    INVITED_ORGANIZATION_MEMBER,
    ORGANIZATION_MEMBER,
)
from sentry.apidocs.examples.project_examples import (
    BASE_PROJECT,
    DETAILED_PROJECT,
    PROJECT_SUMMARY,
)
from sentry.apidocs.examples.team_examples import BASE_TEAM_1, BASE_TEAM_2, TeamExamples

WORLD_TEAMS = {
    world.TEAM_BACKEND["id"]: world.TEAM_BACKEND,
    world.TEAM_FRONTEND["id"]: world.TEAM_FRONTEND,
}
WORLD_PROJECTS = {
    world.PROJECT_BACKEND["id"]: world.PROJECT_BACKEND,
    world.PROJECT_FRONTEND["id"]: world.PROJECT_FRONTEND,
}


def _assert_is_world_team_ref(value: dict[str, Any]) -> None:
    assert value == world.ref(WORLD_TEAMS[value["id"]])


def test_ref_is_the_embedded_summary_shape() -> None:
    assert world.ref(world.TEAM_BACKEND) == {
        "id": world.TEAM_BACKEND["id"],
        "name": world.TEAM_BACKEND["name"],
        "slug": world.TEAM_BACKEND["slug"],
    }


def test_world_identities_are_distinct() -> None:
    ids = [
        world.ORGANIZATION["id"],
        world.TEAM_BACKEND["id"],
        world.TEAM_FRONTEND["id"],
        world.PROJECT_BACKEND["id"],
        world.PROJECT_FRONTEND["id"],
        world.USER_OWNER["id"],
        world.USER_INVITED["id"],
        world.MEMBER_OWNER["id"],
        world.MEMBER_INVITED["id"],
    ]
    assert len(set(ids)) == len(ids)
    assert world.TEAM_BACKEND["slug"] != world.TEAM_FRONTEND["slug"]
    assert world.PROJECT_BACKEND["slug"] != world.PROJECT_FRONTEND["slug"]


def test_project_examples_belong_to_world_teams() -> None:
    for project in (BASE_PROJECT, DETAILED_PROJECT, PROJECT_SUMMARY):
        assert project["id"] in WORLD_PROJECTS
        assert project["slug"] == WORLD_PROJECTS[project["id"]]["slug"]
    _assert_is_world_team_ref(DETAILED_PROJECT["team"])
    for team in PROJECT_SUMMARY["teams"]:
        _assert_is_world_team_ref(team)


def test_team_examples_are_world_teams() -> None:
    for team in (BASE_TEAM_1, BASE_TEAM_2, *TeamExamples.LIST_ORG_TEAMS[0].value):
        assert team["id"] in WORLD_TEAMS
        assert team["slug"] == WORLD_TEAMS[team["id"]]["slug"]
        assert team["name"] == WORLD_TEAMS[team["id"]]["name"]


def test_organization_examples_describe_the_world_organization() -> None:
    retrieved = OrganizationExamples.RETRIEVE_ORGANIZATION[0].value
    updated = OrganizationExamples.UPDATE_ORGANIZATION[0].value
    for organization in (retrieved, updated):
        assert organization["id"] == world.ORGANIZATION["id"]
        assert organization["slug"] == world.ORGANIZATION["slug"]
        assert organization["links"]["organizationUrl"] == world.ORGANIZATION_URL

    for team in updated["teams"]:
        assert team["id"] in WORLD_TEAMS
    for project in updated["projects"]:
        assert project["id"] in WORLD_PROJECTS
        _assert_is_world_team_ref(project["team"])
    for project in OrganizationExamples.LIST_PROJECTS[0].value:
        assert project["id"] in WORLD_PROJECTS
        _assert_is_world_team_ref(project["team"])


def test_member_examples_are_world_users() -> None:
    assert ORGANIZATION_MEMBER["id"] == world.MEMBER_OWNER["id"]
    assert ORGANIZATION_MEMBER["user"]["id"] == world.USER_OWNER["id"]
    assert ORGANIZATION_MEMBER["user"]["email"] == world.USER_OWNER["email"]
    assert INVITED_ORGANIZATION_MEMBER["id"] == world.MEMBER_INVITED["id"]
    assert INVITED_ORGANIZATION_MEMBER["user"] is None
