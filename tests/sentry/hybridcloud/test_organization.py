import itertools
from typing import Any, Callable, List, Optional, Sequence, Tuple

import pytest

from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.team import Team, TeamStatus
from sentry.models.user import User
from sentry.services.hybrid_cloud.access.service import access_service
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcTeam,
    RpcTeamMember,
    organization_service,
)
from sentry.services.hybrid_cloud.organization.serial import serialize_member, unescape_flag_name
from sentry.services.hybrid_cloud.project import RpcProject
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, region_silo_test


def basic_filled_out_org() -> Tuple[Organization, List[User]]:
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
    with assume_test_silo_mode(SiloMode.REGION):
        inactive_team_membership.save()

    return org, [owner, other_user]


def org_with_owner_team() -> Tuple[Organization, Sequence[User]]:
    org, users = basic_filled_out_org()
    other_user = Factories.create_user()
    users.append(other_user)
    Factories.create_team(org, members=[users[1], other_user], org_role="owner")
    Factories.create_team(org, members=[users[1]], org_role="manager")

    return org, users


def parameterize_with_orgs(f: Callable):
    return pytest.mark.parametrize("org_factory", [pytest.param(basic_filled_out_org)])(f)


def parameterize_with_orgs_with_owner_team(f: Callable):
    return pytest.mark.parametrize("org_factory", [pytest.param(org_with_owner_team)])(f)


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


@assume_test_silo_mode(SiloMode.REGION)
def assert_team_equals(orm_team: Team, team: RpcTeam):
    assert team.id == orm_team.id
    assert team.slug == orm_team.slug
    assert team.status == orm_team.status
    assert team.organization_id == orm_team.organization_id
    assert team.org_role == orm_team.org_role


@assume_test_silo_mode(SiloMode.REGION)
def assert_project_equals(orm_project: Project, project: RpcProject):
    assert project.id == orm_project.id
    assert project.status == orm_project.status
    assert project.slug == orm_project.slug
    assert project.organization_id == orm_project.organization_id
    assert project.name == orm_project.name


@assume_test_silo_mode(SiloMode.REGION)
def assert_team_member_equals(orm_team_member: OrganizationMemberTeam, team_member: RpcTeamMember):
    assert team_member.id == orm_team_member.id
    assert team_member.team_id == orm_team_member.team_id
    assert team_member.role == orm_team_member.get_team_role()
    assert team_member.is_active == orm_team_member.is_active
    assert frozenset(team_member.scopes) == orm_team_member.get_scopes()
    assert set(team_member.project_ids) == {
        p.id for p in Project.objects.get_for_team_ids([orm_team_member.team_id])
    }


@assume_test_silo_mode(SiloMode.REGION)
def assert_organization_member_equals(
    orm_organization_member: OrganizationMember, organization_member: RpcOrganizationMember
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
                team__status=TeamStatus.ACTIVE,
            )
        ),
        organization_member.member_teams,
        assert_team_member_equals,
    )
    assert set(organization_member.project_ids) == {
        p.id
        for p in Project.objects.get_for_team_ids(
            [omt.team_id for omt in organization_member.member_teams]
        )
    }

    for field_name in organization_member.flags.get_field_names():
        assert getattr(organization_member.flags, field_name) == getattr(
            orm_organization_member.flags, unescape_flag_name(field_name)
        )


@assume_test_silo_mode(SiloMode.REGION)
def assert_orgs_equal(orm_org: Organization, org: RpcOrganization) -> None:
    assert org.id == orm_org.id
    assert org.name == orm_org.name
    assert org.slug == orm_org.slug

    for field_name in org.flags.get_field_names():
        orm_flag = getattr(orm_org.flags, field_name)
        org_flag = getattr(org.flags, field_name)
        assert orm_flag == org_flag

    with assume_test_silo_mode(SiloMode.REGION):
        assert_for_list(
            list(Team.objects.filter(organization_id=org.id)), org.teams, assert_team_equals
        )
        assert_for_list(
            list(Project.objects.filter(organization_id=org.id)),
            org.projects,
            assert_project_equals,
        )


@assume_test_silo_mode(SiloMode.REGION)
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
    assert org_context is not None
    assert_orgs_equal(orm_org, org_context.organization)
    if user_context is None:
        assert org_context.user_id is None
        assert org_context.member is None
    else:
        assert org_context.user_id == user_context.id
        assert org_context.member is not None
        assert_organization_member_equals(
            OrganizationMember.objects.get(user_id=user_context.id, organization_id=orm_org.id),
            org_context.member,
        )


@django_db_all(transaction=True)
@all_silo_test
@parameterize_with_orgs
def test_get_organization_id(org_factory: Callable[[], Tuple[Organization, List[User]]]):
    orm_org, orm_users = org_factory()

    for user_context in itertools.chain([None], orm_users):
        assert_get_organization_by_id_works(user_context, orm_org)


@django_db_all(transaction=True)
@all_silo_test
@parameterize_with_orgs
def test_idempotency(org_factory: Callable[[], Tuple[Organization, List[User]]]):
    orm_org, orm_users = org_factory()
    new_user = Factories.create_user()

    for i in range(2):
        member = organization_service.add_organization_member(
            organization_id=orm_org.id, default_org_role=orm_org.default_role, user_id=new_user.id
        )
        with assume_test_silo_mode(SiloMode.REGION):
            assert_organization_member_equals(OrganizationMember.objects.get(id=member.id), member)

        member = organization_service.add_organization_member(
            organization_id=orm_org.id,
            default_org_role=orm_org.default_role,
            email="me@thing.com",
        )
        with assume_test_silo_mode(SiloMode.REGION):
            assert_organization_member_equals(OrganizationMember.objects.get(id=member.id), member)


@django_db_all(transaction=True)
@all_silo_test
@parameterize_with_orgs_with_owner_team
def test_get_all_org_roles(org_factory: Callable[[], Tuple[Organization, List[User]]]):
    _, orm_users = org_factory()
    with assume_test_silo_mode(SiloMode.REGION):
        member = OrganizationMember.objects.get(user_id=orm_users[1].id)

    all_org_roles = ["owner", "member", "manager"]
    service_org_roles = access_service.get_all_org_roles(
        organization_id=member.organization_id, member_id=member.id
    )
    assert set(all_org_roles) == set(service_org_roles)


@django_db_all(transaction=True)
@all_silo_test
@parameterize_with_orgs_with_owner_team
def test_get_top_dog_team_member_ids(org_factory: Callable[[], Tuple[Organization, List[User]]]):
    orm_org, orm_users = org_factory()
    with assume_test_silo_mode(SiloMode.REGION):
        members = [OrganizationMember.objects.get(user_id=user.id) for user in orm_users]

    all_top_dogs = [members[1].id, members[2].id]
    service_top_dogs = access_service.get_top_dog_team_member_ids(organization_id=orm_org.id)
    assert set(all_top_dogs) == set(service_top_dogs)


@django_db_all(transaction=True)
@all_silo_test
def test_options():
    org = Factories.create_organization()
    organization_service.update_option(organization_id=org.id, key="test", value="a string")
    organization_service.update_option(organization_id=org.id, key="test2", value=False)
    organization_service.update_option(organization_id=org.id, key="test3", value=5)

    assert organization_service.get_option(organization_id=org.id, key="test") == "a string"
    assert organization_service.get_option(organization_id=org.id, key="test2") is False
    assert organization_service.get_option(organization_id=org.id, key="test3") == 5


class RpcOrganizationMemberTest(TestCase):
    def test_get_audit_log_metadata(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user(email="foobar@sentry.io")
        member = self.create_member(user_id=user.id, role="owner", organization_id=org.id)
        self.create_team(organization=org, slug="baz", members=[user])
        rpc_member = serialize_member(member)
        assert member.get_audit_log_data() == rpc_member.get_audit_log_metadata()


@django_db_all(transaction=True)
@region_silo_test
def test_org_member():
    org = Factories.create_organization()
    user = Factories.create_user(email="test@sentry.io")
    rpc_member = organization_service.add_organization_member(
        organization_id=org.id,
        default_org_role="member",
        user_id=user.id,
        invite_status=InviteStatus.APPROVED.value,
    )
    member_query = OrganizationMember.objects.all()
    assert member_query.count() == 1
    assert member_query[0].role == "member"
    assert rpc_member.id == member_query[0].id

    organization_service.update_organization_member(
        organization_id=org.id, member_id=rpc_member.id, attrs=dict(role="manager")
    )
    member_query = OrganizationMember.objects.all()
    assert member_query.count() == 1
    assert member_query[0].role == "manager"
