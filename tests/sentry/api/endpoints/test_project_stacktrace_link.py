from typing import Any, Mapping
from unittest import mock

import responses

from sentry.api.endpoints.project_stacktrace_link import ProjectStacktraceLinkEndpoint
from sentry.integrations.example.integration import ExampleIntegration
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test

example_base_url = "https://example.com/getsentry/sentry/blob/master"


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


class BaseProjectStacktraceLink(APITestCase):
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

        self.login_as(self.user)

    def expected_configurations(self, code_mapping) -> Mapping[str, Any]:
        return {
            "automaticallyGenerated": code_mapping.automatically_generated,
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


@region_silo_test
class ProjectStacktraceLinkTest(BaseProjectStacktraceLink):
    endpoint = "sentry-api-0-project-stacktrace-link"

    def setUp(self):
        BaseProjectStacktraceLink.setUp(self)
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
        assert response.data["error"] == "file_not_found"
        assert response.data["integrations"] == [serialized_integration(self.integration)]
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

        assert response.data["config"] == self.expected_configurations(self.code_mapping1)
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "file_not_found"
        assert response.data["integrations"] == [serialized_integration(self.integration)]
        assert (
            response.data["attemptedUrl"]
            == f"https://example.com/{self.repo.name}/blob/master/src/sentry/src/sentry/utils/safe.py"
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

    @mock.patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_file_no_stack_root_match(self, mock_integration):
        # Pretend that the file was not found in the repository
        mock_integration.return_value = None

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"file": "something/else/" + self.filepath},
        )
        assert mock_integration.call_count == 0  # How many attempts to find the source code
        assert response.data["config"] is None  # Since no code mapping matched
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]

    @responses.activate
    @with_feature("organizations:codecov-stacktrace-integration")
    @mock.patch(
        "sentry.api.endpoints.project_stacktrace_link.ProjectStacktraceLinkEndpoint.get_codecov_line_coverage"
    )
    @mock.patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_codecov(self, mock_integration, mock_codecov):
        expected_line_coverage = [[1, 0], [3, 1], [4, 0]]
        mock_integration.return_value = "https://github.com/repo/path/to/file.py"
        mock_codecov.return_value = expected_line_coverage
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
        assert response.data["lineCoverage"] == expected_line_coverage

    def test_get_codecov_path(self):
        project_stacktrace_link_endpoint = ProjectStacktraceLinkEndpoint()
        codecov_path = project_stacktrace_link_endpoint.get_codecov_path(
            "https://github.com/getsentry/sentry/blob/8a0bf7246d39cdeb56d457134ee32767673b7492/src/sentry/shared_integrations/client/base.py"
        )
        assert codecov_path == "src/sentry/shared_integrations/client/base.py"


@region_silo_test
class ProjectStacktraceLinkTestMobile(BaseProjectStacktraceLink):
    def setUp(self):
        BaseProjectStacktraceLink.setUp(self)
        self.code_mapping1 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="",
            source_root="",
        )

    @mock.patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
    )
    def test_munge_android_worked(self, mock_integration):
        mock_integration.side_effect = [f"{example_base_url}/usr/src/getsentry/file.java"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "file.java",
                "module": "usr.src.getsentry.file",
                "platform": "java",
            },
        )
        file_path = "usr/src/getsentry/file.java"
        assert response.data["config"] == self.expected_configurations(self.code_mapping1)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"

    @mock.patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
    )
    def test_munge_cocoa_worked(self, mock_integration):
        file_path = "SampleProject/Classes/App Delegate/AppDelegate.swift"
        mock_integration.side_effect = [f"{example_base_url}/{file_path}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "AppDelegate.swift",
                "absPath": f"/Users/user/code/SwiftySampleProject/{file_path}",
                "package": "SampleProject",
                "platform": "cocoa",
            },
        )
        assert response.data["config"] == self.expected_configurations(self.code_mapping1)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"

    @mock.patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
    )
    def test_munge_flutter_worked(self, mock_integration):
        file_path = "a/b/main.dart"
        mock_integration.side_effect = [f"{example_base_url}/{file_path}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "main.dart",
                "absPath": f"package:sentry_flutter_example/{file_path}",
                "package": "sentry_flutter_example",
                "platform": "other",
                "sdkName": "sentry.dart.flutter",
            },
        )
        assert response.data["config"] == self.expected_configurations(self.code_mapping1)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"


class ProjectStacktraceLinkTestMultipleMatches(BaseProjectStacktraceLink):
    def setUp(self):
        BaseProjectStacktraceLink.setUp(self)
        # Created by the user, not well defined stack root
        self.code_mapping1 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="",
            source_root="",
            automatically_generated=False,
        )
        # Created by automation, not as well defined stack root
        self.code_mapping2 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/src/",
            source_root="",
            automatically_generated=True,
        )
        # Created by the user, well defined stack root
        self.code_mapping3 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/",
            source_root="",
            automatically_generated=False,
        )
        # Created by the user, not as well defined stack root
        self.code_mapping4 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/",
            source_root="",
            automatically_generated=False,
        )
        # Created by automation, well defined stack root
        self.code_mapping5 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/src/sentry/",
            source_root="",
            automatically_generated=True,
        )
        self.code_mappings = [
            self.code_mapping1,
            self.code_mapping2,
            self.code_mapping3,
            self.code_mapping4,
            self.code_mapping5,
        ]

        self.filepath = "usr/src/getsentry/src/sentry/src/sentry/utils/safe.py"

    def test_multiple_code_mapping_matches_order(self):
        project_stacktrace_link_endpoint = ProjectStacktraceLinkEndpoint()

        configs = self.code_mappings
        # Expected configs: stack_root, automatically_generated
        expected_config_order = [
            self.code_mapping3,  # "usr/src/getsentry/", False
            self.code_mapping4,  # "usr/src/", False
            self.code_mapping1,  # "", False
            self.code_mapping5,  # "usr/src/getsentry/src/sentry/", True
            self.code_mapping2,  # "usr/src/getsentry/src/", True
        ]

        sorted_configs = project_stacktrace_link_endpoint.sort_code_mapping_configs(configs)
        assert sorted_configs == expected_config_order

    def test_multiple_code_mapping_matches(self):
        with mock.patch.object(
            ExampleIntegration,
            "get_stacktrace_link",
            return_value="https://github.com/usr/src/getsentry/src/sentry/src/sentry/utils/safe.py",
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, qs_params={"file": self.filepath}
            )
            # Assert that the code mapping that is user generated and has the most defined stack
            # trace of the user generated code mappings is chosen
            assert response.data["config"] == self.expected_configurations(self.code_mapping3)
            assert (
                response.data["sourceUrl"]
                == "https://github.com/usr/src/getsentry/src/sentry/src/sentry/utils/safe.py"
            )
