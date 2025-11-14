from typing import int
from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.testutils.cases import APITestCase


class ProjectCodeOwnersEndpointTestCase(APITestCase):
    def setUp(self) -> None:
        self.user = self.create_user("admin@sentry.io", is_superuser=True)

        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
        )
        self.external_user = self.create_external_user(
            external_name="@NisanthanNanthakumar", integration=self.integration
        )
        self.external_team = self.create_external_team(integration=self.integration)
        self.url = reverse(
            "sentry-api-0-project-codeowners",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
            "codeMappingId": self.code_mapping.id,
        }

    def test_no_codeowners(self) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == []

    def test_without_feature_flag(self) -> None:
        with self.feature({"organizations:integrations-codeowners": False}):
            resp = self.client.get(self.url)
        assert resp.status_code == 403
        assert resp.data == {"detail": "You do not have permission to perform this action."}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_codeowners_with_integration_post_creation(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            post_resp = self.client.post(self.url, self.data)
            assert post_resp.status_code == 201
            get_resp = self.client.get(self.url)
        assert get_resp.status_code == 200
        resp_data = get_resp.data[0]
        assert resp_data["raw"] == self.data["raw"].strip()
        assert resp_data["codeMappingId"] == str(self.code_mapping.id)
        assert resp_data["provider"] == self.integration.provider
        assert resp_data["codeOwnersUrl"] == "https://github.com/test/CODEOWNERS"
        assert resp_data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {"type": "user", "id": self.user.id, "name": self.user.email},
                        {"type": "team", "id": self.team.id, "name": self.team.slug},
                    ],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_codeowners_no_schema_initially(self, get_codeowner_mock_file: MagicMock) -> None:
        code_owner = self.create_codeowners(
            self.project, self.code_mapping, raw=f"*.js {self.external_team.external_name}"
        )
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == code_owner.raw
        assert resp_data["dateCreated"] == code_owner.date_added
        assert resp_data["dateUpdated"] == code_owner.date_updated
        assert resp_data["codeMappingId"] == str(self.code_mapping.id)
        assert resp_data["provider"] == self.integration.provider
        assert resp_data["codeOwnersUrl"] == "https://github.com/test/CODEOWNERS"
        assert resp_data["schema"] == {}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_codeowners_with_integration(self, get_codeowner_mock_file: MagicMock) -> None:
        code_owner = self.create_codeowners(
            self.project, self.code_mapping, raw=f"*.js {self.external_team.external_name}"
        )
        code_owner.update_schema(organization=self.organization, raw=code_owner.raw)
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == code_owner.raw
        assert resp_data["dateCreated"] == code_owner.date_added
        assert resp_data["dateUpdated"] == code_owner.date_updated
        assert resp_data["codeMappingId"] == str(self.code_mapping.id)
        assert resp_data["provider"] == self.integration.provider
        assert resp_data["codeOwnersUrl"] == "https://github.com/test/CODEOWNERS"
        assert resp_data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "*.js"},
                    "owners": [{"type": "team", "id": self.team.id, "name": self.team.slug}],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_expanded_codeowners_with_integration(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        code_owner = self.create_codeowners(
            self.project, self.code_mapping, raw=f"*.js {self.external_team.external_name}"
        )
        code_owner.update_schema(organization=self.organization, raw=code_owner.raw)
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(f"{self.url}?expand=codeMapping")
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == code_owner.raw
        assert resp_data["dateCreated"] == code_owner.date_added
        assert resp_data["dateUpdated"] == code_owner.date_updated
        assert resp_data["codeMappingId"] == str(self.code_mapping.id)
        assert resp_data["codeMapping"]["id"] == str(self.code_mapping.id)
        assert resp_data["provider"] == self.integration.provider
        assert resp_data["codeOwnersUrl"] == "https://github.com/test/CODEOWNERS"
        assert resp_data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "*.js"},
                    "owners": [{"type": "team", "id": self.team.id, "name": self.team.slug}],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_basic_post(self, get_codeowner_mock_file: MagicMock) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data["id"]
        assert response.data["raw"] == "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == "codeowners:docs/* admin@sentry.io #tiger-team\n"

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    def test_empty_codeowners_text(self) -> None:
        self.data["raw"] = ""
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"raw": ["This field may not be blank."]}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_invalid_codeowners_text(self, get_codeowner_mock_file: MagicMock) -> None:
        self.data["raw"] = "docs/*"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == ""

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_cannot_find_external_user_name_association(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.data["raw"] = "docs/*  @MeredithAnya"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*  @MeredithAnya"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == ""

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert set(errors["missing_external_users"]) == {"@MeredithAnya"}
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_cannot_find_sentry_user_with_email(self, get_codeowner_mock_file: MagicMock) -> None:
        self.data["raw"] = "docs/*  someuser@sentry.io"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*  someuser@sentry.io"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == ""

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert set(errors["missing_user_emails"]) == {"someuser@sentry.io"}
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_cannot_find_external_team_name_association(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.data["raw"] = "docs/*  @getsentry/frontend\nstatic/* @getsentry/frontend"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*  @getsentry/frontend\nstatic/* @getsentry/frontend"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == ""

        errors = response.data["errors"]
        assert set(errors["missing_external_teams"]) == {"@getsentry/frontend"}
        assert errors["missing_external_users"] == []
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_cannot_find__multiple_external_name_association(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.data["raw"] = "docs/*  @AnotherUser @getsentry/frontend @getsentry/docs"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*  @AnotherUser @getsentry/frontend @getsentry/docs"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == ""

        errors = response.data["errors"]
        assert set(errors["missing_external_teams"]) == {"@getsentry/frontend", "@getsentry/docs"}
        assert set(errors["missing_external_users"]) == {"@AnotherUser"}
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    def test_missing_code_mapping_id(self) -> None:
        self.data.pop("codeMappingId")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This field is required."]}

    def test_invalid_code_mapping_id(self) -> None:
        self.data["codeMappingId"] = 500
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This code mapping does not exist."]}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_no_duplicates_allowed(self, get_codeowner_mock_file: MagicMock) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
            assert response.status_code == 201, response.content
            response = self.client.post(self.url, self.data)
            assert response.status_code == 400
            assert response.data == {"codeMappingId": ["This code mapping is already in use."]}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_schema_is_correct(self, get_codeowner_mock_file: MagicMock) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data["id"]
        project_codeowners = ProjectCodeOwners.objects.get(id=response.data["id"])
        assert project_codeowners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"id": self.user.id, "identifier": self.user.email, "type": "user"},
                        {"id": self.team.id, "identifier": self.team.slug, "type": "team"},
                    ],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_case_insensitive_team_matching(self, get_codeowner_mock_file: MagicMock) -> None:
        """Test that team names are matched case-insensitively in CODEOWNERS files."""

        external_team_name = self.external_team.external_name
        capitalized_external_team_name = external_team_name.swapcase()

        self.data[
            "raw"
        ] = f"""
        src/frontend/* {external_team_name}
        src/frontend2/* {capitalized_external_team_name}
        """

        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)

        assert response.status_code == 201, response.content

        assert (
            response.data["ownershipSyntax"]
            == f"codeowners:src/frontend/* #{self.team.slug}\ncodeowners:src/frontend2/* #{self.team.slug}\n"
        )

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_multiple_mappings_to_same_sentry_team(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        """Multiple external teams map to the same Sentry team"""

        # 2 external teams that map to the same Sentry team
        # so 2 external actors @getsentry/ecosystem and @other-external-team both map to #tiger-team
        external_team_2 = self.create_external_team(
            team=self.team,
            integration=self.integration,
            external_name="@getsentry/other-external-team",
        )

        assert self.external_team.external_name != external_team_2.external_name

        self.data[
            "raw"
        ] = f"""
        src/frontend/* {self.external_team.external_name}
        src/frontend2/* {external_team_2.external_name}
        """

        with self.feature(
            {
                "organizations:integrations-codeowners": True,
            }
        ):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content

        assert (
            response.data["ownershipSyntax"]
            == f"codeowners:src/frontend/* #{self.team.slug}\ncodeowners:src/frontend2/* #{self.team.slug}\n"
        )

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_schema_preserves_comments(self, get_codeowner_mock_file: MagicMock) -> None:
        self.data["raw"] = "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data["id"]
        project_codeowners = ProjectCodeOwners.objects.get(id=response.data["id"])
        assert project_codeowners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"id": self.user.id, "identifier": self.user.email, "type": "user"},
                        {"id": self.team.id, "identifier": self.team.slug, "type": "team"},
                    ],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_raw_email_correct_schema(self, get_codeowner_mock_file: MagicMock) -> None:
        self.data["raw"] = f"docs/*    {self.user.email}   @getsentry/ecosystem\n"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data["id"]
        project_codeowners = ProjectCodeOwners.objects.get(id=response.data["id"])
        assert project_codeowners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"id": self.user.id, "identifier": self.user.email, "type": "user"},
                        {"id": self.team.id, "identifier": self.team.slug, "type": "team"},
                    ],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_codeowners_scope_emails_to_org_security(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.user2 = self.create_user("user2@sentry.io")
        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   user2@sentry.io\n",
            "codeMappingId": self.code_mapping.id,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["id"]
        assert response.data["raw"] == "docs/*    @NisanthanNanthakumar   user2@sentry.io"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == "codeowners:docs/* admin@sentry.io\n"

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert set(errors["missing_user_emails"]) == {self.user2.email}
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_multiple_codeowners_for_project(self, get_codeowner_mock_file: MagicMock) -> None:
        code_mapping_2 = self.create_code_mapping(stack_root="src/")
        self.create_codeowners(code_mapping=code_mapping_2)
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_users_without_access(self, get_codeowner_mock_file: MagicMock) -> None:
        user_2 = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, user=user_2, role="member")
        team_2 = self.create_team(name="foo", organization=self.organization, members=[user_2])
        self.create_project(organization=self.organization, teams=[team_2], slug="bass")
        self.create_external_user(
            user=user_2, external_name="@foobarSentry", integration=self.integration
        )
        self.data["raw"] = "docs/*  @foobarSentry\nstatic/* @foobarSentry"
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*  @foobarSentry\nstatic/* @foobarSentry"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == ""

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert set(errors["users_without_access"]) == {user_2.email}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_post_with_schema(self, get_codeowner_mock_file: MagicMock) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201
        assert response.data["raw"] == "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {"type": "user", "id": self.user.id, "identifier": "admin@sentry.io"},
                        {"type": "team", "id": self.team.id, "identifier": "tiger-team"},
                    ],
                }
            ],
        }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get(self, get_codeowner_mock_file: MagicMock) -> None:
        self.client.post(self.url, self.data)
        response = self.client.get(self.url)

        response_data = response.data[0]
        assert response.status_code == 200
        assert response_data["raw"] == "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem"
        assert response_data["codeMappingId"] == str(self.code_mapping.id)
        assert response_data["schema"] == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {
                            "type": "user",
                            "id": self.user.id,
                            "name": "admin@sentry.io",
                        },
                        {"type": "team", "id": self.team.id, "name": "tiger-team"},
                    ],
                }
            ],
        }
        assert response_data["codeOwnersUrl"] == "https://github.com/test/CODEOWNERS"

        # Assert that "identifier" is not renamed to "name" in the backend
        ownership = ProjectCodeOwners.objects.get(project=self.project)
        assert ownership.schema["rules"] == [
            {
                "matcher": {"type": "codeowners", "pattern": "docs/*"},
                "owners": [
                    {"type": "user", "identifier": "admin@sentry.io", "id": self.user.id},
                    {"type": "team", "identifier": "tiger-team", "id": self.team.id},
                ],
            }
        ]

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    @patch("sentry.tasks.codeowners.update_code_owners_schema")
    def test_get_one_external_user_deletion_schema_updates_triggered(
        self, mock_update_code_owners_schema: MagicMock, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user = self.create_external_user(
            user=self.member_user_delete, external_name="@delete", integration=self.integration
        )
        self.data["raw"] = "docs/*  @delete @getsentry/ecosystem"

        with self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            self.external_delete_user.delete()

            # 2 calls: creation of one external user, deletion of one external user
            assert mock_update_code_owners_schema.apply_async.call_count == 2

            # Schema updates haven't run, so we should get the original schema
            response = self.client.get(self.url)
            assert response.data[0]["schema"] == {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "codeowners", "pattern": "docs/*"},
                        "owners": [
                            {
                                "type": "user",
                                "name": self.member_user_delete.email,
                                "id": self.member_user_delete.id,
                            },
                            {"type": "team", "name": self.team.slug, "id": self.team.id},
                        ],
                    }
                ],
            }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_one_external_user_deletion_schema_updates_correct(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user = self.create_external_user(
            user=self.member_user_delete, external_name="@delete", integration=self.integration
        )
        self.data["raw"] = "docs/*  @delete @getsentry/ecosystem"

        with self.tasks(), self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            self.external_delete_user.delete()

            response = self.client.get(self.url)
            assert response.data[0]["schema"] == {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "codeowners", "pattern": "docs/*"},
                        "owners": [{"type": "team", "name": self.team.slug, "id": self.team.id}],
                    }
                ],
            }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    @patch("sentry.tasks.codeowners.update_code_owners_schema")
    def test_get_all_external_users_deletion_schema_updates_triggered(
        self, mock_update_code_owners_schema: MagicMock, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user = self.create_external_user(
            user=self.member_user_delete, external_name="@delete", integration=self.integration
        )
        self.data["raw"] = "docs/*  @delete"

        with self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            self.external_delete_user.delete()

            # 2 calls: creation of one external user, deletion of one external user
            assert mock_update_code_owners_schema.apply_async.call_count == 2

            # Schema updates haven't run, so we should get the original schema
            response = self.client.get(self.url)
            assert response.data[0]["schema"] == {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"pattern": "docs/*", "type": "codeowners"},
                        "owners": [
                            {
                                "type": "user",
                                "name": self.member_user_delete.email,
                                "id": self.member_user_delete.id,
                            }
                        ],
                    }
                ],
            }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_all_external_users_deletion_schema_updates_correct(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.member_user_delete = self.create_user("member_delete@localhost", is_superuser=False)
        self.create_member(
            user=self.member_user_delete,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user = self.create_external_user(
            user=self.member_user_delete, external_name="@delete", integration=self.integration
        )
        self.data["raw"] = "docs/*  @delete"

        with self.tasks(), self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            self.external_delete_user.delete()

            response = self.client.get(self.url)
            assert response.data[0]["schema"] == {"$version": 1, "rules": []}

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    @patch("sentry.tasks.codeowners.update_code_owners_schema")
    def test_get_multiple_rules_deleted_owners_schema_updates_triggered(
        self, mock_update_code_owners_schema: MagicMock, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.member_user_delete_1 = self.create_user(
            "member_delete_1@localhost", is_superuser=False
        )
        self.create_member(
            user=self.member_user_delete_1,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user_1 = self.create_external_user(
            user=self.member_user_delete_1, external_name="@delete-1", integration=self.integration
        )

        self.member_user_delete_2 = self.create_user(
            "member_delete_2@localhost", is_superuser=False
        )
        self.create_member(
            user=self.member_user_delete_2,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user_2 = self.create_external_user(
            user=self.member_user_delete_2, external_name="@delete-2", integration=self.integration
        )
        self.data["raw"] = (
            "docs/*  @delete-1\n*.py @getsentry/ecosystem @delete-1\n*.css @delete-2\n*.rb @NisanthanNanthakumar"
        )

        with self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            self.external_delete_user_1.delete()
            self.external_delete_user_2.delete()

            # 4 calls: creation of two external users, deletion of two external users
            assert mock_update_code_owners_schema.apply_async.call_count == 4

            # Schema updates haven't run, so we should get the original schema
            response = self.client.get(self.url)
            assert response.data[0]["schema"] == {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "codeowners", "pattern": "docs/*"},
                        "owners": [
                            {
                                "type": "user",
                                "name": self.member_user_delete_1.email,
                                "id": self.member_user_delete_1.id,
                            }
                        ],
                    },
                    {
                        "matcher": {"type": "codeowners", "pattern": "*.py"},
                        "owners": [
                            {"type": "team", "name": self.team.slug, "id": self.team.id},
                            {
                                "type": "user",
                                "name": self.member_user_delete_1.email,
                                "id": self.member_user_delete_1.id,
                            },
                        ],
                    },
                    {
                        "matcher": {
                            "pattern": "*.css",
                            "type": "codeowners",
                        },
                        "owners": [
                            {
                                "type": "user",
                                "name": self.member_user_delete_2.email,
                                "id": self.member_user_delete_2.id,
                            },
                        ],
                    },
                    {
                        "matcher": {"type": "codeowners", "pattern": "*.rb"},
                        "owners": [
                            {
                                "type": "user",
                                "name": self.user.email,
                                "id": self.user.id,
                            }
                        ],
                    },
                ],
            }

    @patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
        return_value={"html_url": "https://github.com/test/CODEOWNERS"},
    )
    def test_get_multiple_rules_deleted_owners_schema_updates_correct(
        self, get_codeowner_mock_file: MagicMock
    ) -> None:
        self.member_user_delete_1 = self.create_user(
            "member_delete_1@localhost", is_superuser=False
        )
        self.create_member(
            user=self.member_user_delete_1,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user_1 = self.create_external_user(
            user=self.member_user_delete_1, external_name="@delete-1", integration=self.integration
        )

        self.member_user_delete_2 = self.create_user(
            "member_delete_2@localhost", is_superuser=False
        )
        self.create_member(
            user=self.member_user_delete_2,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.external_delete_user_2 = self.create_external_user(
            user=self.member_user_delete_2, external_name="@delete-2", integration=self.integration
        )
        self.data["raw"] = (
            "docs/*  @delete-1\n*.py @getsentry/ecosystem @delete-1\n*.css @delete-2\n*.rb @NisanthanNanthakumar"
        )

        with self.tasks(), self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            self.external_delete_user_1.delete()
            self.external_delete_user_2.delete()

            response = self.client.get(self.url)
            assert response.data[0]["schema"] == {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "codeowners", "pattern": "*.py"},
                        "owners": [{"type": "team", "name": self.team.slug, "id": self.team.id}],
                    },
                    {
                        "matcher": {"type": "codeowners", "pattern": "*.rb"},
                        "owners": [
                            {
                                "type": "user",
                                "name": self.user.email,
                                "id": self.user.id,
                            }
                        ],
                    },
                ],
            }
