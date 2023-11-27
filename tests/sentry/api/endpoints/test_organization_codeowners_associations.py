from rest_framework import status

from sentry.api.validators.project_codeowners import validate_codeowners_associations
from sentry.models.integrations.integration import Integration
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class OrganizationCodeOwnersAssociationsEndpointTest(APITestCase):
    method = "GET"
    endpoint = "sentry-api-0-organization-codeowners-associations"

    def setUp(self):
        self.user_1 = self.create_user("walter.mitty@life.com")
        self.user_2 = self.create_user("exec@life.com")
        self.organization = self.create_organization(name="Life")
        self.create_member(user=self.user_1, organization=self.organization, role="manager")
        self.create_member(user=self.user_2, organization=self.organization, role="manager")
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
            user=self.user_1, external_name="@walter", integration=self.integration
        )
        self.external_team = self.create_external_team(
            team=self.team_2, external_name="@life/exec", integration=self.integration
        )
        self.data_1 = {
            "raw": "negatives/*  @life/exec @hernando\nexec/* @life/exec\n",
            "codeMappingId": self.code_mapping_1.id,
        }
        self.data_2 = {
            "raw": "negatives/*  @life/exec @walter @hernando\nquintessence/* @walter @sean\n",
            "codeMappingId": self.code_mapping_2.id,
        }
        self.login_as(user=self.user_1)

    def test_no_codeowners(self):
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        assert response.data == {}

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
            assert code_owner.project.slug in response.data.keys()
            associations, errors = validate_codeowners_associations(
                code_owner.raw, code_owner.project
            )
            assert "associations" in response.data[code_owner.project.slug].keys()
            assert response.data[code_owner.project.slug]["associations"] == associations
            assert "errors" in response.data[code_owner.project.slug].keys()
            assert response.data[code_owner.project.slug]["errors"] == errors

    def test_response_data_is_correct(self):
        """
        Tests that response has the correct associations and errors per ProjectCodeOwners object
        """
        self.create_codeowners(self.project_1, self.code_mapping_1, raw=self.data_1["raw"])
        self.create_codeowners(self.project_2, self.code_mapping_2, raw=self.data_2["raw"])
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        assert len(response.data.keys()) == 2

        # First project associations
        assert "@life/exec" in response.data[self.project_1.slug]["associations"].keys()
        assert (
            response.data[self.project_1.slug]["associations"]["@life/exec"]
            == f"#{self.team_2.slug}"
        )

        # First project errors
        assert "@hernando" in response.data[self.project_1.slug]["errors"]["missing_external_users"]

        # Second project associations
        assert "@walter" in response.data[self.project_2.slug]["associations"].keys()
        assert response.data[self.project_2.slug]["associations"]["@walter"] == self.user_1.email

        # Second project errors
        assert "@hernando" in response.data[self.project_2.slug]["errors"]["missing_external_users"]
        assert "@sean" in response.data[self.project_2.slug]["errors"]["missing_external_users"]
        assert (
            f"#{self.team_2.slug}"
            in response.data[self.project_2.slug]["errors"]["teams_without_access"]
        )

    def test_member_can_access(self):
        """
        Tests that users without the 'org:read' scope (i.e. Members) can access this endpoint.
        """
        member = self.create_user("hernando@life.com")
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)
        self.get_success_response(self.organization.slug)

    def test_query_by_provider(self):
        """
        Tests that the provider query parameter filters the returned associations appropriately.
        """
        self.create_codeowners(self.project_1, self.code_mapping_1, raw=self.data_1["raw"])
        self.create_codeowners(self.project_2, self.code_mapping_2, raw=self.data_2["raw"])

        response = self.get_success_response(
            self.organization.slug, status=status.HTTP_200_OK, provider="life"
        )
        assert response.data == {}

        response = self.get_success_response(
            self.organization.slug, status=status.HTTP_200_OK, provider="github"
        )
        assert len(response.data.keys()) == 2

        # Create a codeowners under the "life" provider, and check the query parameter again
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(provider="life", name="Life")
            organization_integration = integration.add_organization(self.organization, self.user)
        project_3 = self.create_project(
            organization=self.organization, teams=[self.team_1, self.team_2]
        )
        code_mapping_3 = self.create_code_mapping(
            project=project_3, organization_integration=organization_integration
        )
        self.create_codeowners(project_3, code_mapping_3, raw=self.data_2["raw"])

        response = self.get_success_response(
            self.organization.slug, status=status.HTTP_200_OK, provider="life"
        )
        assert len(response.data.keys()) == 1
        assert project_3.slug in response.data.keys()

        # Ensure all associations are returned without the provider specified
        response = self.get_success_response(self.organization.slug, status=status.HTTP_200_OK)
        assert len(response.data.keys()) == 3
