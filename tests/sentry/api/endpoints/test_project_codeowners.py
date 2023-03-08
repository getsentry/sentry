from django.urls import reverse

from sentry.models import ProjectCodeOwners
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectCodeOwnersEndpointTestCase(APITestCase):
    def setUp(self):
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
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )
        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
            "codeMappingId": self.code_mapping.id,
        }

    def test_no_codeowners(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == []

    def test_without_feature_flag(self):
        resp = self.client.get(self.url)
        assert resp.status_code == 403
        assert resp.data == {"detail": "You do not have permission to perform this action."}

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
        assert response.data["ownershipSyntax"] == "codeowners:docs/* admin@sentry.io #tiger-team\n"

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

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
        assert errors["users_without_access"] == []

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
        assert errors["users_without_access"] == []

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
        assert errors["users_without_access"] == []

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
        assert errors["users_without_access"] == []

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
        assert errors["users_without_access"] == []

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
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"identifier": self.user.email, "type": "user", "id": self.user.id},
                        {"identifier": self.team.slug, "type": "team", "id": self.team.id},
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
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"identifier": self.user.email, "type": "user", "id": self.user.id},
                        {"identifier": self.team.slug, "type": "team", "id": self.team.id},
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
                    "matcher": {"pattern": "docs/*", "type": "codeowners"},
                    "owners": [
                        {"identifier": self.user.email, "type": "user", "id": self.user.id},
                        {"identifier": self.team.slug, "type": "team", "id": self.team.id},
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
        assert response.data["ownershipSyntax"] == "codeowners:docs/* admin@sentry.io\n"

        errors = response.data["errors"]
        assert errors["missing_external_teams"] == []
        assert errors["missing_external_users"] == []
        assert set(errors["missing_user_emails"]) == {self.user2.email}
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    def test_multiple_codeowners_for_project(self):
        code_mapping_2 = self.create_code_mapping(stack_root="src/")
        self.create_codeowners(code_mapping=code_mapping_2)
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.post(self.url, self.data)
        assert response.status_code == 201

    def test_users_without_access(self):
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

    def test_post_with_streamline_targeting(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            with self.feature({"organizations:streamline-targeting-context": True}):
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

    def test_get(self):
        # Test post + get without the streamline-targeting-context flag
        with self.feature({"organizations:integrations-codeowners": True}):
            self.client.post(self.url, self.data)
            response_no_schema = self.client.get(self.url)
            assert "schema" not in response_no_schema.data[0].keys()

            # Test get after with the streamline-targeting-context flag
            with self.feature({"organizations:streamline-targeting-context": True}):
                self.client.get(self.url)
                response = self.client.get(self.url)
                response_data = response.data[0]
                assert response.status_code == 200
                assert (
                    response_data["raw"] == "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem"
                )
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
