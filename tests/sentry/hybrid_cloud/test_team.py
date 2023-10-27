from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


@django_db_all(transaction=True)
@region_silo_test(stable=True)
def test_get_or_create_team_member():
    org = Factories.create_organization()
    Factories.create_organization()
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
