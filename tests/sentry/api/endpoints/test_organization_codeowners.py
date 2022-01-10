from rest_framework import status

from sentry.api.serializers import serialize
from sentry.api.serializers.models.projectcodeowners import ProjectCodeOwnersSerializer
from sentry.testutils import APITestCase

GITHUB_CODEOWNER = {
    "filepath": "CODEOWNERS",
    "html_url": "https://example.com/example/CODEOWNERS",
    "raw": "* @MeredithAnya\n",
}


class OrganizationCodeOwnersEndpointTest(APITestCase):
    method = "GET"
    endpoint = "sentry-api-0-organization-codeowners"

    def setUp(self):
        self.user_1 = self.create_user("walter.mitty@life.com")
        self.user_2 = self.create_user("exec@life.com")
        self.organization = self.create_organization(name="Life")
        self.team_1 = self.create_team(
            organization=self.organization,
            slug="negative-assets",
            members=[self.user_1, self.user_2],
        )
        self.team_2 = self.create_team(
            organization=self.organization, slug="executives", members=[self.user_2]
        )
        self.project_1 = self.create_project(
            organization=self.organization, teams=[self.team_1, self.team_2], slug="final-cover"
        )
        self.project_2 = self.create_project(
            organization=self.organization, teams=[self.team_1], slug="number-25"
        )
        self.code_mapping_1 = self.create_code_mapping(project=self.project_1)
        self.code_mapping_2 = self.create_code_mapping(project=self.project_2)
        self.external_user = self.create_external_user(
            user=self.user, external_name="@walter", integration=self.integration
        )
        self.external_team = self.create_external_team(
            team=self.team_2, external_name="@life/exec", integration=self.integration
        )
        self.data_1 = {
            "raw": "negatives/*  @life/exec @walter @hernando\nexec/* @life/exec\n",
            "codeMappingId": self.code_mapping_1.id,
        }
        self.data_2 = {
            "raw": "negatives/*  @life/exec @walter @hernando\nquintessence/* @walter @sean\n",
            "codeMappingId": self.code_mapping_2.id,
        }
        self.login_as(user=self.user_1)

    def test_no_codeowners(self):
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        assert response.data == []

    def test_simple(self):
        """
        Tests that all the ProjectCodeOwners are serialized in the response
        """
        code_owner_1 = self.create_codeowners(
            self.project_1, self.code_mapping_1, raw=self.data_1["raw"]
        )
        code_owner_2 = self.create_codeowners(
            self.project_2, self.code_mapping_2, raw=self.data_2["raw"]
        )
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        for code_owner in [code_owner_1, code_owner_2]:
            assert (
                serialize(
                    code_owner,
                    self.user_1,
                    serializer=ProjectCodeOwnersSerializer(expand=["errors"]),
                )
                in response.data
            )

    def test_errors_in_codeowners_are_serialized(self):
        """
        Tests that the ProjectCodeOwners are serialized with their respective errors in tact
        """
        self.create_codeowners(self.project_1, self.code_mapping_1, raw=self.data_1["raw"])
        self.create_codeowners(self.project_2, self.code_mapping_2, raw=self.data_2["raw"])
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        assert len(response.data) == 2
        for code_owner in response.data:
            # Check error object shape
            assert "codeMappingId" in code_owner.keys()
            assert "errors" in code_owner.keys()
            for field in [
                "missing_external_users",
                "missing_external_teams",
                "users_without_access",
                "teams_without_access",
            ]:
                assert field in code_owner["errors"].keys()
            # Check individual code owners for their errors
            if int(code_owner["codeMappingId"]) == self.data_1["codeMappingId"]:
                assert "@hernando" in code_owner["errors"]["missing_external_users"]

            if int(code_owner["codeMappingId"]) == self.data_2["codeMappingId"]:
                assert "@hernando" in code_owner["errors"]["missing_external_users"]
                assert "@sean" in code_owner["errors"]["missing_external_users"]
                assert "#executives" in code_owner["errors"]["teams_without_access"]

    def test_varied_access_to_project(self):
        """
        Tests that projects the requesting user does not have access to are not in the response
        """
        self.create_codeowners(self.project_1, self.code_mapping_1, raw=self.data_1["raw"])
        self.create_codeowners(self.project_2, self.code_mapping_2, raw=self.data_2["raw"])
        # Create a project/code owners that user_1 doesn't have access to
        project_3 = self.create_project(
            organization=self.organization, teams=[self.team_2], slug="fire-everyone"
        )
        code_mapping_3 = self.create_code_mapping(project=project_3)
        code_owners = self.create_codeowners(project_3, code_mapping_3, raw="all/*  @life/exec\n")
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        # Check the original two code owners are still visible
        assert len(response.data) == 2
        assert (
            serialize(
                code_owners,
                self.user,
                serializer=ProjectCodeOwnersSerializer(expand=["errors"]),
            )
            not in response.data
        )
        # Check that a user who can see all the projects receives them all
        self.login_as(self.user_2)
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        assert len(response.data) == 3
        assert (
            serialize(
                code_owners,
                self.user,
                serializer=ProjectCodeOwnersSerializer(expand=["errors"]),
            )
            in response.data
        )
