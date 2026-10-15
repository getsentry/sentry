from sentry.integrations.models.external_actor import ExternalActor
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature


class ExternalTeamDetailsTest(APITestCase):
    endpoint = "sentry-api-0-external-team-details"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

        self.external_team = self.create_external_team(
            self.team, external_name="@getsentry/ecosystem"
        )

    def test_basic_delete(self) -> None:
        self.get_success_response(
            self.organization.slug, self.team.slug, self.external_team.id, method="delete"
        )
        assert not ExternalActor.objects.filter(id=str(self.external_team.id)).exists()

    def test_basic_update(self) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            data = {"externalName": "@getsentry/growth"}
            response = self.get_success_response(
                self.organization.slug, self.team.slug, self.external_team.id, **data
            )

        assert response.data["id"] == str(self.external_team.id)
        assert response.data["externalName"] == "@getsentry/growth"
        self.external_team.refresh_from_db()
        assert self.external_team.team_id == self.team.id

    def test_ignore_teamid(self) -> None:
        other_team = self.create_team(organization=self.organization)
        data = {
            "externalName": "@getsentry/growth",
            "teamId": other_team.id,
            "team_id": other_team.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            self.get_success_response(
                self.organization.slug, self.team.slug, self.external_team.id, **data
            )
        self.external_team.refresh_from_db()
        assert self.external_team.team_id == self.team.id

    @with_feature(["organizations:team-roles", "organizations:integrations-codeowners"])
    def _assert_other_team_rejected(self, method: str, status_code: int) -> None:
        other_team = self.create_team(organization=self.organization)
        other_external_team = self.create_external_team(other_team, external_name="@org/other")
        original = ExternalActor.objects.filter(id=other_external_team.id).values().get()
        user = self.create_user()
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(self.team, member, role="admin")
        self.login_as(user)

        self.get_error_response(
            self.organization.slug,
            other_team.slug,
            other_external_team.id,
            method=method,
            status_code=403,
        )
        self.get_error_response(
            self.organization.slug,
            self.team.slug,
            other_external_team.id,
            method=method,
            status_code=status_code,
            externalName="@org/changed",
        )
        assert ExternalActor.objects.filter(id=other_external_team.id).values().get() == original

        self.get_success_response(
            self.organization.slug,
            self.team.slug,
            self.external_team.id,
            method=method,
            externalName="@org/changed",
        )

    def test_update_another_teams_external_team(self) -> None:
        self._assert_other_team_rejected("put", status_code=403)

    def test_delete_another_teams_external_team(self) -> None:
        self._assert_other_team_rejected("delete", status_code=404)

    @with_feature(["organizations:team-roles", "organizations:integrations-codeowners"])
    def test_remap_requires_permission_on_both_teams(self) -> None:
        destination = self.create_team(organization=self.organization)
        user = self.create_user()
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(self.team, member, role="admin")
        self.login_as(user)

        self.get_error_response(
            self.organization.slug,
            destination.slug,
            self.external_team.id,
            status_code=403,
        )
        self.external_team.refresh_from_db()
        assert self.external_team.team_id == self.team.id

        self.create_team_membership(destination, member, role="admin")
        response = self.get_success_response(
            self.organization.slug,
            destination.slug,
            self.external_team.id,
            externalName="@org/remapped",
        )
        self.external_team.refresh_from_db()
        assert response.data["id"] == str(self.external_team.id)
        assert self.external_team.team_id == destination.id
        assert self.external_team.external_name == "@org/remapped"

    @with_feature("organizations:integrations-codeowners")
    def test_cannot_remap_external_user(self) -> None:
        external_user = self.create_external_user(external_name="@org/user")
        original = ExternalActor.objects.filter(id=external_user.id).values().get()
        self.get_error_response(
            self.organization.slug,
            self.team.slug,
            external_user.id,
            status_code=404,
            externalName="@org/remapped",
        )
        assert ExternalActor.objects.filter(id=external_user.id).values().get() == original

    def test_invalid_provider_update(self) -> None:
        data = {"provider": "git"}
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.get_error_response(
                self.organization.slug,
                self.team.slug,
                self.external_team.id,
                status_code=400,
                **data,
            )
        assert response.data == {"provider": ['"git" is not a valid choice.']}

    def test_delete_another_orgs_external_team(self) -> None:
        other_team = self.create_team(organization=self.create_organization())
        external_team = self.create_external_team(other_team)
        self.get_error_response(
            self.organization.slug,
            self.team.slug,
            external_team.id,
            method="delete",
            status_code=404,
        )
        assert ExternalActor.objects.filter(id=external_team.id).exists()
