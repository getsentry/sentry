from unittest import mock
from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.analytics.events.codeowners_max_length_exceeded import CodeOwnersMaxLengthExceeded
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time


class ProjectCodeOwnersDetailsEndpointTestCase(APITestCase):
    def setUp(self) -> None:
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
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "codeowners_id": self.codeowners.id,
            },
        )

        # Mock the external HTTP request to prevent real network calls
        self.codeowner_patcher = patch(
            "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
            return_value={
                "html_url": "https://github.com/test/CODEOWNERS",
                "filepath": "CODEOWNERS",
                "raw": "test content",
            },
        )
        self.codeowner_mock = self.codeowner_patcher.start()
        self.addCleanup(self.codeowner_patcher.stop)

    def test_basic_delete(self) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.delete(self.url)
        assert response.status_code == 204
        assert not ProjectCodeOwners.objects.filter(id=str(self.codeowners.id)).exists()

    @freeze_time("2023-10-03 00:00:00")
    def test_basic_update(self) -> None:
        self.create_external_team(external_name="@getsentry/frontend", integration=self.integration)
        self.create_external_team(external_name="@getsentry/docs", integration=self.integration)
        raw = "\n# cool stuff comment\n*.js                    @getsentry/frontend @NisanthanNanthakumar\n# good comment\n\n\n  docs/*  @getsentry/docs @getsentry/ecosystem\n\n"
        data = {
            "raw": raw,
        }

        # Reset call count to verify this specific test's calls
        self.codeowner_mock.reset_mock()

        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, data)

        # Verify our mock was called instead of making real HTTP requests
        assert self.codeowner_mock.called, (
            "Mock should have been called - no external HTTP requests made"
        )

        assert response.status_code == 200
        assert response.data["id"] == str(self.codeowners.id)
        assert response.data["raw"] == raw.strip()
        codeowner = ProjectCodeOwners.objects.get(id=self.codeowners.id)
        assert codeowner.date_updated.strftime("%Y-%m-%d %H:%M:%S") == "2023-10-03 00:00:00"

    def test_wrong_codeowners_id(self) -> None:
        self.url = reverse(
            "sentry-api-0-project-codeowners-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "codeowners_id": 1000,
            },
        )
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, self.data)
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_missing_external_associations_update(self) -> None:
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

    def test_invalid_code_mapping_id_update(self) -> None:
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, {"codeMappingId": 500})
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This code mapping does not exist."]}

    def test_no_duplicates_code_mappings(self) -> None:
        new_code_mapping = self.create_code_mapping(project=self.project, stack_root="blah")
        self.create_codeowners(project=self.project, code_mapping=new_code_mapping)
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, {"codeMappingId": new_code_mapping.id})
            assert response.status_code == 400
            assert response.data == {"codeMappingId": ["This code mapping is already in use."]}

    def test_codeowners_email_update(self) -> None:
        data = {"raw": f"\n# cool stuff comment\n*.js {self.user.email}\n# good comment\n\n\n"}
        with self.feature({"organizations:integrations-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data["raw"] == "# cool stuff comment\n*.js admin@sentry.io\n# good comment"

    @patch("sentry.analytics.record")
    def test_codeowners_max_raw_length(self, mock_record: MagicMock) -> None:
        with mock.patch(
            "sentry.issues.endpoints.serializers.MAX_RAW_LENGTH", len(self.data["raw"]) + 1
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

            assert_last_analytics_event(
                mock_record,
                CodeOwnersMaxLengthExceeded(
                    organization_id=self.organization.id,
                ),
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
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                    "codeowners_id": codeowners.id,
                },
            )
            with self.feature({"organizations:integrations-codeowners": True}):
                response = self.client.put(url, data)

            assert ProjectCodeOwners.objects.get(id=codeowners.id).raw == data.get("raw")
