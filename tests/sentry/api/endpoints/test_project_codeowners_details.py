from datetime import datetime, timezone
from unittest import mock
from unittest.mock import patch

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectCodeOwnersDetailsEndpointTestCase(APITestCase):
    def setUp(self):
        self.user = self.create_user("admin@sentry.io", is_superuser=True)

        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

        self.code_mapping = self.create_code_mapping(project=self.project)
        self.external_user = self.create_external_user(
            external_name="@NisanthanNanthakumar", integration=self.integration
        )
        self.external_team = self.create_external_team(integration=self.integration)
        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
        }
        self.codeowners = self.create_codeowners(
            project=self.project, code_mapping=self.code_mapping
        )
        self.url = reverse(
            "sentry-api-0-project-codeowners-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "codeowners_id": self.codeowners.id,
            },
        )

    def test_basic_delete(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.delete(self.url)
        assert response.status_code == 204
        assert not ProjectCodeOwners.objects.filter(id=str(self.codeowners.id)).exists()

    @patch("django.utils.timezone.now")
    def test_basic_update(self, mock_timezone_now):
        self.create_external_team(external_name="@getsentry/frontend", integration=self.integration)
        self.create_external_team(external_name="@getsentry/docs", integration=self.integration)
        date = datetime(2023, 10, 3, tzinfo=timezone.utc)
        mock_timezone_now.return_value = date
        raw = "\n# cool stuff comment\n*.js                    @getsentry/frontend @NisanthanNanthakumar\n# good comment\n\n\n  docs/*  @getsentry/docs @getsentry/ecosystem\n\n"
        data = {
            "raw": raw,
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data["id"] == str(self.codeowners.id)
        assert response.data["raw"] == raw.strip()
        codeowner = ProjectCodeOwners.objects.filter(id=self.codeowners.id)[0]
        assert codeowner.date_updated == date

    def test_wrong_codeowners_id(self):
        self.url = reverse(
            "sentry-api-0-project-codeowners-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "codeowners_id": 1000,
            },
        )
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, self.data)
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_missing_external_associations_update(self):
        data = {
            "raw": "\n# cool stuff comment\n*.js                    @getsentry/frontend @NisanthanNanthakumar\n# good comment\n\n\n  docs/*  @getsentry/docs @getsentry/ecosystem\nsrc/sentry/*       @AnotherUser\n\n"
        }
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data["id"] == str(self.codeowners.id)
        assert response.data["codeMappingId"] == str(self.code_mapping.id)

        errors = response.data["errors"]
        assert set(errors["missing_external_teams"]) == {"@getsentry/frontend", "@getsentry/docs"}
        assert set(errors["missing_external_users"]) == {"@AnotherUser"}
        assert errors["missing_user_emails"] == []
        assert errors["teams_without_access"] == []
        assert errors["users_without_access"] == []

    def test_invalid_code_mapping_id_update(self):
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, {"codeMappingId": 500})
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This code mapping does not exist."]}

    def test_no_duplicates_code_mappings(self):
        new_code_mapping = self.create_code_mapping(project=self.project, stack_root="blah")
        self.create_codeowners(project=self.project, code_mapping=new_code_mapping)
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, {"codeMappingId": new_code_mapping.id})
            assert response.status_code == 400
            assert response.data == {"codeMappingId": ["This code mapping is already in use."]}

    def test_codeowners_email_update(self):
        data = {"raw": f"\n# cool stuff comment\n*.js {self.user.email}\n# good comment\n\n\n"}
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data["raw"] == "# cool stuff comment\n*.js admin@sentry.io\n# good comment"

    @patch("sentry.analytics.record")
    def test_codeowners_max_raw_length(self, mock_record):
        with mock.patch(
            "sentry.api.endpoints.codeowners.MAX_RAW_LENGTH", len(self.data["raw"]) + 1
        ):
            data = {
                "raw": f"#                cool stuff     comment\n*.js {self.user.email}\n# good comment"
            }

            with self.feature({"organizations:integrations-codeowners": True}):
                response = self.client.put(self.url, data)
            assert response.status_code == 400
            assert response.data == {
                "raw": [
                    ErrorDetail(
                        string=f"Raw needs to be <= {len(self.data['raw']) + 1} characters in length",
                        code="invalid",
                    )
                ]
            }

            mock_record.assert_called_with(
                "codeowners.max_length_exceeded",
                organization_id=self.organization.id,
            )

            # Test that we allow this to be modified for existing large rows
            code_mapping = self.create_code_mapping(project=self.project, stack_root="/")
            codeowners = self.create_codeowners(
                project=self.project,
                code_mapping=code_mapping,
                raw=f"*.py            test@localhost                         #{self.team.slug}",
            )
            url = reverse(
                "sentry-api-0-project-codeowners-details",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "project_slug": self.project.slug,
                    "codeowners_id": codeowners.id,
                },
            )
            with self.feature({"organizations:integrations-codeowners": True}):
                response = self.client.put(url, data)

            assert ProjectCodeOwners.objects.get(id=codeowners.id).raw == data.get("raw")
