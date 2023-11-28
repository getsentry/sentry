from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


@django_db_all(transaction=True)
@region_silo_test
def test_get_or_create_team_member():
    org = Factories.create_organization()
    user = Factories.create_user(email="test@sentry.io")
    member = Factories.create_member(organization=org, user_id=user.id)
    team = Factories.create_team(org)

    organization_service.get_or_create_team_member(
        organization_id=org.id,
        team_id=team.id,
        organization_member_id=member.id,
    )
    member_query = OrganizationMemberTeam.objects.all()
    assert member_query.count() == 1
    assert member_query[0].role == "contributor"

    organization_service.get_or_create_team_member(
        organization_id=org.id,
        team_id=team.id,
        organization_member_id=member.id,
        role="admin",
    )
    member_query = OrganizationMemberTeam.objects.all()
    assert member_query.count() == 1
    assert member_query[0].role == "admin"


@django_db_all(transaction=True)
@region_silo_test
def test_get_or_create_default_team():
    org = Factories.create_organization()
    team = Factories.create_team(org)
    team.update(status=TeamStatus.PENDING_DELETION)
    assert Team.objects.all().count() == 1

    rpc_team = organization_service.get_or_create_default_team(
        organization_id=org.id,
        new_team_slug="test-team",
    )
    # There are two teams but only one is ACTIVE
    assert rpc_team.slug == "test-team"
    assert rpc_team.name == "test-team"
    assert Team.objects.all().count() == 2

    # Creating another team to make sure the first one is always returned
    Factories.create_team(org)
    assert Team.objects.all().count() == 3

    rpc_team = organization_service.get_or_create_default_team(
        organization_id=org.id,
        new_team_slug="test-another-team",
    )
    # Default team exists so not creating a new team
    assert rpc_team.slug == "test-team"
    assert Team.objects.all().count() == 3
