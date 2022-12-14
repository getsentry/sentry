import dataclasses
import itertools
from typing import Any, Callable, List, Optional, Sequence, Tuple

import pytest

from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    Team,
    TeamStatus,
    User,
)
from sentry.services.hybrid_cloud.organization import (
    ApiOrganization,
    ApiOrganizationMember,
    ApiProject,
    ApiTeam,
    ApiTeamMember,
    organization_service,
)
from sentry.services.hybrid_cloud.organization.impl import unescape_flag_name
from sentry.testutils.factories import Factories
from sentry.testutils.hybrid_cloud import use_real_service
from sentry.testutils.silo import all_silo_test


def basic_filled_out_org() -> Tuple[Organization, Sequence[User]]:
    owner = Factories.create_user()
    other_user = Factories.create_user()
    Factories.create_organization()  # unrelated org that shouldn't be in the result set
    org = Factories.create_organization(owner=owner)
    team_1 = Factories.create_team(org, members=[owner, other_user])
    team_2 = Factories.create_team(org, members=[other_user])
    team_3 = Factories.create_team(org)
    pending_delete_team = Factories.create_team(org, status=TeamStatus.PENDING_DELETION)
    deletion_in_progress_team = Factories.create_team(org, status=TeamStatus.DELETION_IN_PROGRESS)

    Factories.create_project(organization=org, teams=[team_1, pending_delete_team])
    Factories.create_project(
        organization=org, teams=[pending_delete_team, deletion_in_progress_team]
    )
    Factories.create_project(organization=org, teams=[team_2, deletion_in_progress_team])
    Factories.create_project(organization=org, teams=[team_1, team_2])
    Factories.create_project(organization=org, teams=[team_1])
    Factories.create_project(organization=org, teams=[team_2])

    # a distinct project and team that can only be reached by one user due to an is_active=False link.
    Factories.create_project(organization=org, teams=[team_3])
    Factories.create_team_membership(team=team_3, user=owner)
    inactive_team_membership = Factories.create_team_membership(team=team_3, user=other_user)
    inactive_team_membership.is_active = False
    inactive_team_membership.save()

    return org, [owner, other_user]


def parameterize_with_orgs(f: Callable):
    return pytest.mark.parametrize("org_factory", [pytest.param(basic_filled_out_org)])(f)


def find_ordering(list_of_things: List[Any], e: Any) -> int:
    try:
        return list_of_things.index(e)
    except ValueError:
        return -1


def order_things_by_id(a: List[Any], b: List[Any]) -> None:
    b_ids = [x.id for x in b]
    a.sort(key=lambda i: find_ordering(b_ids, i.id))


def assert_for_list(a: List[Any], b: List[Any], assertion: Callable) -> None:
    assert len(a) == len(b)
    order_things_by_id(a, b)
    for a_thing, b_thing in zip(a, b):
        assertion(a_thing, b_thing)


def assert_team_equals(orm_team: Team, team: ApiTeam):
    assert team.id == orm_team.id
    assert team.slug == orm_team.slug
    assert team.status == orm_team.status
    assert team.organization_id == orm_team.organization_id


def assert_project_equals(orm_project: Project, project: ApiProject):
    assert project.id == orm_project.id
    assert project.status == orm_project.status
    assert project.slug == orm_project.slug
    assert project.organization_id == orm_project.organization_id
    assert project.name == orm_project.name


def assert_team_member_equals(orm_team_member: OrganizationMemberTeam, team_member: ApiTeamMember):
    assert team_member.id == orm_team_member.id
    assert team_member.team_id == orm_team_member.team_id
    assert team_member.role == orm_team_member.get_team_role()
    assert team_member.is_active == orm_team_member.is_active
    assert frozenset(team_member.scopes) == orm_team_member.get_scopes()
    assert set(team_member.project_ids) == {
        p.id for p in Project.objects.get_for_team_ids([orm_team_member.team_id])
    }


def assert_organization_member_equals(
    orm_organization_member: OrganizationMember, organization_member: ApiOrganizationMember
):
    assert organization_member.organization_id == orm_organization_member.organization_id
    assert organization_member.id == orm_organization_member.id
    assert organization_member.user_id == orm_organization_member.user_id
    assert organization_member.role == orm_organization_member.role
    assert frozenset(organization_member.scopes) == orm_organization_member.get_scopes()
    assert_for_list(
        list(
            OrganizationMemberTeam.objects.filter(
                organizationmember_id=orm_organization_member.id,
                is_active=True,
                team__status=TeamStatus.VISIBLE,
            )
        ),
        organization_member.member_teams,
        assert_team_member_equals,
    )
    assert set(organization_member.project_ids) == {
        p.id
        for p in Project.objects.get_for_team_ids(
            omt.team_id for omt in organization_member.member_teams
        )
    }

    for field in dataclasses.fields(organization_member.flags):
        assert getattr(organization_member.flags, field.name) == getattr(
            orm_organization_member.flags, unescape_flag_name(field.name)
        )


def assert_orgs_equal(orm_org: Organization, org: ApiOrganization) -> None:
    assert org.id == orm_org.id
    assert org.name == orm_org.name
    assert org.slug == orm_org.slug

    for field in dataclasses.fields(org.flags):
        orm_flag = getattr(orm_org.flags, field.name)
        org_flag = getattr(org.flags, field.name)
        assert orm_flag == org_flag

    assert_for_list(
        list(Team.objects.filter(organization_id=org.id)), org.teams, assert_team_equals
    )
    assert_for_list(
        list(Project.objects.filter(organization_id=org.id)), org.projects, assert_project_equals
    )


def assert_get_organization_by_id_works(user_context: Optional[User], orm_org: Organization):
    assert (
        organization_service.get_organization_by_id(
            id=-2, user_id=user_context.id if user_context else None
        )
        is None
    )
    org_context = organization_service.get_organization_by_id(
        id=orm_org.id, user_id=user_context.id if user_context else None
    )
    assert_orgs_equal(orm_org, org_context.organization)
    if user_context is None:
        assert org_context.user_id is None
        assert org_context.member is None
    else:
        assert org_context.user_id == user_context.id
        assert_organization_member_equals(
            OrganizationMember.objects.get(user_id=user_context.id, organization_id=orm_org.id),
            org_context.member,
        )


@pytest.mark.django_db(transaction=True)
@all_silo_test
@parameterize_with_orgs
@use_real_service(organization_service, None)
def test_get_organization_id(org_factory: Callable[[], Organization]):
    orm_org, orm_users = org_factory()

    for user_context in itertools.chain([None], orm_users):
        assert_get_organization_by_id_works(user_context, orm_org)
