from django.urls import reverse

from sentry.models import Integration, ProjectCodeOwners
from sentry.testutils import APITestCase


class ProjectCodeOwnersEndpointTestCase(APITestCase):
    def setUp(self):
        self.user = self.create_user("admin@sentry.io", is_superuser=True)

        self.login_as(user=self.user)

        self.integration = Integration.objects.create(
            provider="github", name="GitHub", external_id="github:1"
        )
        self.oi = self.integration.add_organization(self.organization, self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            organization_integration=self.oi,
        )
        self.external_user = self.create_external_user(
            external_name="@NisanthanNanthakumar", integration=self.integration
        )
        self.external_team = self.create_external_team(integration=self.integration)
        self.url = reverse(
            "sentry-api-0-project-codeowners",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )
        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
            "codeMappingId": self.code_mapping.id,
        }

    def _create_codeowner_without_integration(self):
        self.integration = Integration.objects.create(
            provider="github",
            name="getsentry",
            external_id="1234",
            metadata={"domain_name": "github.com/getsentry"},
        )
        self.integration.add_organization(self.organization, self.user)
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/sentry",
        )
        self.code_mapping_without_integration = self.create_code_mapping(
            project=self.project,
            repo=self.repo,
            stack_root="webpack://",
        )
        self.code_owner = self.create_codeowners(
            self.project, self.code_mapping_without_integration, raw="*.js @tiger-team"
        )

    def test_no_codeowners(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == []

    def test_without_feature_flag(self):
        resp = self.client.get(self.url)
        assert resp.status_code == 403
        assert resp.data == {"detail": "You do not have permission to perform this action."}

    def test_codeowners_without_integrations(self):
        self._create_codeowner_without_integration()
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == self.code_owner.raw
        assert resp_data["dateCreated"] == self.code_owner.date_added
        assert resp_data["dateUpdated"] == self.code_owner.date_updated
        assert resp_data["codeMappingId"] == str(self.code_mapping_without_integration.id)
        assert resp_data["provider"] == "unknown"

    def test_codeowners_with_integration(self):
        code_owner = self.create_codeowners(self.project, self.code_mapping, raw="*.js @tiger-team")
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == code_owner.raw
        assert resp_data["dateCreated"] == code_owner.date_added
        assert resp_data["dateUpdated"] == code_owner.date_updated
        assert resp_data["codeMappingId"] == str(self.code_mapping.id)
        assert resp_data["provider"] == self.integration.provider

    def test_get_expanded_codeowners_with_integration(self):
        code_owner = self.create_codeowners(self.project, self.code_mapping, raw="*.js @tiger-team")
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(f"{self.url}?expand=codeMapping")
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == code_owner.raw
        assert resp_data["dateCreated"] == code_owner.date_added
        assert resp_data["dateUpdated"] == code_owner.date_updated
        assert resp_data["codeMappingId"] == str(self.code_mapping.id)
        assert resp_data["provider"] == self.integration.provider
        assert resp_data["codeMapping"]["id"] == str(self.code_mapping.id)

    def test_basic_post(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data["id"]
        assert response.data["raw"] == "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem"
        assert response.data["codeMappingId"] == str(self.code_mapping.id)
        assert response.data["provider"] == "github"
        assert response.data["ownershipSyntax"] == "path:docs/* admin@sentry.io #tiger-team\n"

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []

    def test_empty_codeowners_text(self):
        self.data["raw"] = ""
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"raw": ["This field may not be blank."]}

    def test_invalid_codeowners_text(self):
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

    def test_cannot_find_external_user_name_association(self):
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

    def test_cannot_find_sentry_user_with_email(self):
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

    def test_cannot_find_external_team_name_association(self):
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

    def test_cannot_find__multiple_external_name_association(self):
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

    def test_missing_code_mapping_id(self):
        self.data.pop("codeMappingId")
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This field is required."]}

    def test_invalid_code_mapping_id(self):
        self.data["codeMappingId"] = 500
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This code mapping does not exist."]}

    def test_no_duplicates_allowed(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
            assert response.status_code == 201, response.content
            response = self.client.post(self.url, self.data)
            assert response.status_code == 400
            assert response.data == {"codeMappingId": ["This code mapping is already in use."]}

    def test_schema_is_correct(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201, response.content
        assert response.data["id"]
        project_codeowners = ProjectCodeOwners.objects.get(id=response.data["id"])
        assert project_codeowners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"pattern": "docs/*", "type": "path"},
                    "owners": [
                        {"identifier": self.user.email, "type": "user"},
                        {"identifier": self.team.slug, "type": "team"},
                    ],
                }
            ],
        }

    def test_schema_preserves_comments(self):
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
                    "matcher": {"pattern": "docs/*", "type": "path"},
                    "owners": [
                        {"identifier": self.user.email, "type": "user"},
                        {"identifier": self.team.slug, "type": "team"},
                    ],
                }
            ],
        }

    def test_raw_email_correct_schema(self):
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
                    "matcher": {"pattern": "docs/*", "type": "path"},
                    "owners": [
                        {"identifier": self.user.email, "type": "user"},
                        {"identifier": self.team.slug, "type": "team"},
                    ],
                }
            ],
        }

    def test_codeowners_scope_emails_to_org_security(self):
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
        assert response.data["ownershipSyntax"] == "path:docs/* admin@sentry.io\n"

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert set(errors["missing_user_emails"]) == {self.user2.email}
        assert errors["teams_without_access"] == []
