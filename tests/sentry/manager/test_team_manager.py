from sentry.auth.services.service_account import service_account_service
from sentry.models.team import Team
from sentry.testutils.cases import TestCase
from sentry.users.services.user.service import user_service


class TeamManagerTest(TestCase):
    def test_simple(self) -> None:
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])

        result = Team.objects.get_for_user(organization=org, user=user)
        assert result == [team]

    def test_simple_with_rpc_user(self) -> None:
        user = user_service.get_user(self.create_user().id)
        assert user is not None
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user_id=user.id, teams=[team])

        result = Team.objects.get_for_user(organization=org, user=user)
        assert result == [team]

    def test_service_account_membership_does_not_collide_with_user_membership(self) -> None:
        shared_id = 1_000_000
        user = self.create_user(id=shared_id)
        org = self.create_organization()
        user_team = self.create_team(organization=org, name="User team")
        account_team = self.create_team(organization=org, name="Service account team")
        self.create_member(organization=org, user=user, teams=[user_team])
        account = self.create_service_account(
            id=shared_id,
            organization_id=org.id,
            name="Deploy bot",
        )
        self.create_member(
            organization=org,
            service_account_id=account.id,
            teams=[account_team],
        )
        detail = service_account_service.get(
            organization_id=org.id,
            service_account_id=account.id,
        )
        assert detail is not None

        result = Team.objects.get_for_user(organization=org, user=detail.account)

        assert result == [account_team]

    def test_invalid_scope(self) -> None:
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        result = Team.objects.get_for_user(organization=org, user=user, scope="idontexist")
        assert result == []

    def test_valid_scope(self) -> None:
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])
        result = Team.objects.get_for_user(organization=org, user=user, scope="project:read")
        assert result == [team]

    def test_user_no_access(self) -> None:
        user = self.create_user()
        user2 = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, name="Test")
        self.create_member(organization=org, user=user, teams=[team])

        result = Team.objects.get_for_user(organization=org, user=user2)
        assert result == []
