from collections.abc import Mapping
from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import quote

from sentry.integrations.example.integration import ExampleIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

example_base_url = "https://example.com/getsentry/sentry/blob/master"
git_blame = [
    {
        "commit": {
            "oid": "5c7dc040fe713f718193e28972b43db94e5097b3",
            "author": {"name": "Jodi Jang", "email": "jodi@example.com"},
            "message": "initial commit",
            "committedDate": "2022-10-20T17:17:15Z",
        },
        "startingLine": 1,
        "endingLine": 23,
        "age": 10,
    },
    {
        "commit": {
            "oid": "5c7dc040fe713f718193e28972b43db94e5097b4",
            "author": {"name": "Jodi Jang", "email": "jodi@example.com"},
            "message": "commit2",
            "committedDate": "2022-10-25T20:17:15Z",
        },
        "startingLine": 24,
        "endingLine": 27,
        "age": 10,
    },
    {
        "commit": {
            "oid": "5c7dc040fe713f718193e28972b43db94e5097b5",
            "author": {"name": "Jodi Jang", "email": "jodi@example.com"},
            "message": "commit2",
            "committedDate": "2022-10-25T17:17:15Z",
        },
        "startingLine": 24,
        "endingLine": 27,
        "age": 10,
    },
]


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

    def setUp(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration, self.oi = self.create_provider_integration_for(
                self.organization, self.user, provider="example", name="Example"
            )

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

        self.login_as(self.user)

    def expected_configurations(
        self, code_mapping: RepositoryProjectPathConfig
    ) -> Mapping[str, Any]:
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


class ProjectStacktraceLinkTest(BaseProjectStacktraceLink):
    endpoint = "sentry-api-0-project-stacktrace-link"

    def setUp(self) -> None:
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

    def test_no_filepath(self) -> None:
        """The file query search is missing"""
        response = self.get_error_response(
            self.organization.slug, self.project.slug, status_code=400
        )
        assert response.data == {"detail": "Filepath is required"}

    def test_no_configs(self) -> None:
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
            "error": "no_code_mappings_for_project",
        }

    def test_file_not_found_error(self) -> None:
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

    def test_stack_root_mismatch_error(self) -> None:
        """Looking for a stacktrace file path that will not match any code mappings"""
        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"file": "wrong/file/path"}
        )
        assert response.data["config"] is None
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]

    def test_config_and_source_url(self) -> None:
        """Having a different source url should also work"""
        with patch.object(
            ExampleIntegration, "get_stacktrace_link", return_value="https://sourceurl.com/"
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, qs_params={"file": self.filepath}
            )
            assert response.data["config"] == self.expected_configurations(self.code_mapping1)
            assert response.data["sourceUrl"] == "https://sourceurl.com/"
            assert response.data["integrations"] == [serialized_integration(self.integration)]

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_file_no_stack_root_match(self, mock_integration: MagicMock) -> None:
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

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_file_with_square_brackets(self, mock_integration: MagicMock) -> None:
        """
        File paths with square brackets should be encoded in the source url
        """
        # Add a code mapping that matches the test file path
        code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="src/sentry/",
            source_root="",
        )
        file_path = "src/sentry/api/projects/[projectId]/event_id.py"
        encoded_path = quote(file_path)
        mock_integration.side_effect = [f"{example_base_url}/{encoded_path}"]
        response = self.get_success_response(
            self.organization.slug, self.project.slug, qs_params={"file": file_path}
        )
        assert response.data["config"] == self.expected_configurations(code_mapping)
        assert (
            response.data["sourceUrl"]
            == "https://example.com/getsentry/sentry/blob/master/src/sentry/api/projects/%5BprojectId%5D/event_id.py"
        )


class ProjectStacktraceLinkTestMobile(BaseProjectStacktraceLink):
    def setUp(self) -> None:
        BaseProjectStacktraceLink.setUp(self)
        self.android_code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/",
            source_root="src/getsentry/",
        )
        self.flutter_code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="a/b/",
            source_root="",
        )
        self.cocoa_code_mapping_filename = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="AppDelegate",
            source_root="src/AppDelegate",
        )
        self.cocoa_code_mapping_abs_path = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="/Users/user/code/SwiftySampleProject/",
            source_root="src/",
        )

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_munge_android_worked(self, mock_integration: MagicMock) -> None:
        file_path = "src/getsentry/file.java"
        mock_integration.side_effect = [f"{example_base_url}/{file_path}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "file.java",
                "module": "usr.src.getsentry.file",
                "platform": "java",
            },
        )
        assert response.data["config"] == self.expected_configurations(self.android_code_mapping)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_munge_android_failed_stack_root_mismatch(self, mock_integration: MagicMock) -> None:
        """
        Returns a stack_root_mismatch if module doesn't match stack root
        """
        file_path = "src/getsentry/file.java"
        mock_integration.side_effect = [f"{example_base_url}/{file_path}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "file.java",
                "module": "foo.src.getsentry.file",  # Should not match code mapping
                "platform": "java",
            },
        )

        assert not response.data["config"]
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_cocoa_abs_path_success(self, mock_integration: MagicMock) -> None:
        """
        Cocoa events with code mappings referencing the abs_path should apply correctly.
        """
        filename = "AppDelegate.swift"
        mock_integration.side_effect = [f"{example_base_url}/src/{filename}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "AppDelegate.swift",
                "absPath": f"/Users/user/code/SwiftySampleProject/{filename}",
                "package": "SampleProject",
                "platform": "cocoa",
            },
        )
        mock_integration.assert_called_with(self.repo, f"src/{filename}", "master", None)
        assert response.data["config"] == self.expected_configurations(
            self.cocoa_code_mapping_abs_path
        )
        assert response.data["sourceUrl"] == f"{example_base_url}/src/{filename}"

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_cocoa_filename_success(self, mock_integration: MagicMock) -> None:
        """
        Cocoa events with code mappings that match the file should apply correctly.
        """
        filename = "AppDelegate.swift"
        mock_integration.side_effect = [f"{example_base_url}/src/{filename}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": "AppDelegate.swift",
                "absPath": f"/Foo/user/code/SwiftySampleProject/{filename}",
                "package": "SampleProject",
                "platform": "cocoa",
            },
        )
        mock_integration.assert_called_with(self.repo, f"src/{filename}", "master", None)
        assert response.data["config"] == self.expected_configurations(
            self.cocoa_code_mapping_filename
        )
        assert response.data["sourceUrl"] == f"{example_base_url}/src/{filename}"

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_cocoa_failed_stack_root_mismatch(self, mock_integration: MagicMock) -> None:
        """
        Should return stack_root_mismatch if stack root doesn't match file or abs_path
        """
        filename = "OtherFile.swift"
        mock_integration.side_effect = [f"{example_base_url}/src/{filename}"]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": filename,
                "absPath": f"/Foo/user/code/SwiftySampleProject/{filename}",
                "package": "SampleProject",
                "platform": "cocoa",
            },
        )

        assert not response.data["config"]
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [serialized_integration(self.integration)]

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_munge_flutter_worked(self, mock_integration: MagicMock) -> None:
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
        assert response.data["config"] == self.expected_configurations(self.flutter_code_mapping)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"


class ProjectStacktraceLinkTestMultipleMatches(BaseProjectStacktraceLink):
    def setUp(self) -> None:
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

    def test_multiple_code_mapping_matches(self) -> None:
        with patch.object(
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
