from typing import Any, Mapping
from unittest import mock

from sentry.integrations.example.integration import ExampleIntegration
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


def serialized_provider() -> Mapping[str, Any]:
    """TODO(mgaeta): Make these into fixtures."""
    return {
        "aspects": {},
        "canAdd": True,
        "canDisable": False,
        "features": ["commits", "issue-basic", "stacktrace-link"],
        "key": "example",
        "name": "Example",
        "slug": "example",
    }


def serialized_integration(integration: Integration) -> Mapping[str, Any]:
    """TODO(mgaeta): Make these into fixtures."""
    return {
        "accountType": None,
        "domainName": None,
        "icon": None,
        "id": str(integration.id),
        "name": "Example",
        "provider": serialized_provider(),
        "scopes": None,
        "status": "active",
    }


@region_silo_test
class ProjectStacktraceLinkTest(APITestCase):
    endpoint = "sentry-api-0-project-stacktrace-link"

    def setUp(self):
        self.integration = Integration.objects.create(provider="example", name="Example")
        self.integration.add_organization(self.organization, self.user)
        self.oi = OrganizationIntegration.objects.get(integration_id=self.integration.id)

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

        self.code_mapping1 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/",
            source_root="",
        )
        self.code_mapping2 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="sentry/",
            source_root="src/sentry/",
            automatically_generated=True,  # Created by the automation
        )

        self.filepath = "usr/src/getsentry/src/sentry/src/sentry/utils/safe.py"
        self.login_as(self.user)

    def expected_configurations(self, code_mapping) -> Mapping[str, Any]:
        return {
            "defaultBranch": "master",
            "id": str(code_mapping.id),
            "integrationId": str(self.integration.id),
            "projectId": str(self.project.id),
            "projectSlug": self.project.slug,
            "provider": serialized_provider(),
            "repoId": str(self.repo.id),
            "repoName": self.repo.name,
            "sourceRoot": code_mapping.source_root,
            "stackRoot": code_mapping.stack_root,
        }

    def test_no_filepath(self):
        """The file query search is missing"""
        response = self.get_error_response(
            self.organization.slug, self.project.slug, status_code=400
        )
        assert response.data == {"detail": "Filepath is required"}

    def test_no_configs(self):
        """No code mappings have been set for this project"""
        # new project that has no configurations set up for it
        project = self.create_project(
            name="bloop",
            organization=self.organization,
            teams=[self.create_team(organization=self.organization)],
        )

        response = self.get_success_response(
            self.organization.slug, project.slug, qs_params={"file": self.filepath}
        )
        assert response.data == {
            "config": None,
            "sourceUrl": None,
            "integrations": [serialized_integration(self.integration)],
        }

    def test_file_not_found_error(self):
        """File matches code mapping but it cannot be found in the source repository."""
        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"file": self.filepath}
        )
        assert response.data["config"] == self.expected_configurations(self.code_mapping1)
        assert not response.data["sourceUrl"]
        # XXX: This depends on what was the last attempted code mapping
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]
        # XXX: This depends on what was the last attempted code mapping
        assert (
            response.data["attemptedUrl"]
            == f"https://example.com/{self.repo.name}/blob/master/src/sentry/src/sentry/utils/safe.py"
        )

    def test_stack_root_mismatch_error(self):
        """Looking for a stacktrace file path that will not match any code mappings"""
        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"file": "wrong/file/path"}
        )
        assert response.data["config"] is None
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]

    def test_config_and_source_url(self):
        """Having a different source url should also work"""
        with mock.patch.object(
            ExampleIntegration, "get_stacktrace_link", return_value="https://sourceurl.com/"
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, qs_params={"file": self.filepath}
            )
            assert response.data["config"] == self.expected_configurations(self.code_mapping1)
            assert response.data["sourceUrl"] == "https://sourceurl.com/"
            assert response.data["integrations"] == [serialized_integration(self.integration)]

    @mock.patch("sentry.api.endpoints.project_stacktrace_link.munged_filename_and_frames")
    @mock.patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_file_not_found_and_munge_frame_fallback_not_found(self, mock_integration, mock_munger):
        mock_integration.return_value = None
        mock_munger.return_value = None

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": self.filepath,
                "absPath": "abs_path",
                "module": "module",
                "package": "package",
            },
        )

        assert response.data["config"] == self.expected_configurations(self.code_mapping2)
        assert not response.data["sourceUrl"]
        # XXX: This depends on what was the last attempted code mapping
        assert response.data["error"] == "file_not_found"
        assert response.data["integrations"] == [serialized_integration(self.integration)]
        # XXX: This depends on what was the last attempted code mapping
        assert (
            response.data["attemptedUrl"]
            == f"https://example.com/{self.repo.name}/blob/master/usr/src/getsrc/sentry/src/sentry/src/sentry/utils/safe.py"
        )

    @mock.patch("sentry.api.endpoints.project_stacktrace_link.munged_filename_and_frames")
    @mock.patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
    )
    def test_file_not_found_munge_frame_fallback_success(self, mock_integration, mock_munger):
        mock_integration.side_effect = [None, "https://github.com/repo/path/to/munged/file.py"]
        mock_munger.return_value = (
            "munged_filename",
            [{"munged_filename": "usr/src/getsentry/file.py"}],
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": self.filepath,
                "absPath": "any",
                "module": "any",
                "package": "any",
            },
        )
        assert mock_integration.call_count == 2
        assert response.data["config"] == self.expected_configurations(self.code_mapping1)
        assert response.data["sourceUrl"] == "https://github.com/repo/path/to/munged/file.py"
        assert response.data["integrations"] == [serialized_integration(self.integration)]

    @mock.patch("sentry.api.endpoints.project_stacktrace_link.munged_filename_and_frames")
    @mock.patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
    )
    def test_file_stack_root_mismatch_and_munge_frame_fallback_stack_root_mismatch(
        self, mock_integration, mock_munger
    ):
        mock_integration.return_value = None
        mock_munger.return_value = ("munged_filename", [{"munged_filename": "munged"}])

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "something/else/" + self.filepath,
                "absPath": "any",
                "module": "any",
                "package": "any",
            },
        )
        assert mock_integration.call_count == 2  # As many code mappings there are for this project
        assert response.data["config"] == self.expected_configurations(self.code_mapping2)
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]
