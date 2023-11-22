import logging
from typing import Any, Mapping
from unittest.mock import patch

import pytest
import responses

from sentry import options
from sentry.integrations.example.integration import ExampleIntegration
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test

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

    def setUp(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
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
        with patch.object(
            ExampleIntegration, "get_stacktrace_link", return_value="https://sourceurl.com/"
        ):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, qs_params={"file": self.filepath}
            )
            assert response.data["config"] == self.expected_configurations(self.code_mapping1)
            assert response.data["sourceUrl"] == "https://sourceurl.com/"
            assert response.data["integrations"] == [serialized_integration(self.integration)]

    @patch("sentry.api.endpoints.project_stacktrace_link.munged_filename_and_frames")
    @patch.object(ExampleIntegration, "get_stacktrace_link")
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

    @patch("sentry.api.endpoints.project_stacktrace_link.munged_filename_and_frames")
    @patch.object(ExampleIntegration, "get_stacktrace_link")
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

    @patch.object(ExampleIntegration, "get_stacktrace_link")
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


@region_silo_test
class ProjectStacktraceLinkTestMobile(BaseProjectStacktraceLink):
    def setUp(self):
        BaseProjectStacktraceLink.setUp(self)
        self.android_code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/",
            source_root="src/getsentry/",
        )
        self.cocoa_code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="SampleProject/",
            source_root="",
        )
        self.flutter_code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="a/b/",
            source_root="",
        )

    @patch.object(ExampleIntegration, "get_stacktrace_link")
    def test_munge_android_worked(self, mock_integration):
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
        assert response.data["config"] == self.expected_configurations(self.cocoa_code_mapping)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"

    @patch.object(ExampleIntegration, "get_stacktrace_link")
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
        assert response.data["config"] == self.expected_configurations(self.flutter_code_mapping)
        assert response.data["sourceUrl"] == f"{example_base_url}/{file_path}"


class ProjectStracktraceLinkTestCodecov(BaseProjectStacktraceLink):
    def setUp(self):
        BaseProjectStacktraceLink.setUp(self)
        options.set("codecov.client-secret", "supersecrettoken")
        self.code_mapping1 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="",
            source_root="",
        )
        self.filepath = "src/path/to/file.py"
        self.organization.flags.codecov_access = True

        self.expected_codecov_url = (
            "https://app.codecov.io/gh/getsentry/sentry/commit/master/blob/src/path/to/file.py"
        )
        self.expected_line_coverage = [[1, 0], [3, 1], [4, 0]]
        self.organization.save()

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    @patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
        return_value="https://github.com/repo/blob/a67ea84967ed1ec42844720d9daf77be36ff73b0/src/path/to/file.py",
    )
    @responses.activate
    def test_codecov_line_coverage_success(self, mock_integration):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/example/getsentry/repos/sentry/file_report/src/path/to/file.py",
            status=200,
            json={
                "line_coverage": self.expected_line_coverage,
                "commit_file_url": self.expected_codecov_url,
                "commit_sha": "a67ea84967ed1ec42844720d9daf77be36ff73b0",
            },
            content_type="application/json",
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": self.filepath,
                "absPath": "abs_path",
                "module": "module",
                "package": "package",
                "commitId": "a67ea84967ed1ec42844720d9daf77be36ff73b0",
            },
        )

        assert response.data["codecov"]["lineCoverage"] == self.expected_line_coverage
        assert response.data["codecov"]["status"] == 200

    @patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
        return_value="https://github.com/repo/blob/master/src/path/to/file.py",
    )
    @responses.activate
    def test_codecov_line_coverage_with_branch_success(self, mock_integration):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/example/getsentry/repos/sentry/file_report/src/path/to/file.py",
            status=200,
            json={
                "line_coverage": self.expected_line_coverage,
                "commit_file_url": self.expected_codecov_url,
                "commit_sha": "a67ea84967ed1ec42844720d9daf77be36ff73b0",
            },
            content_type="application/json",
        )

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
        assert response.data["codecov"]["lineCoverage"] == self.expected_line_coverage
        assert response.data["codecov"]["status"] == 200

    @patch.object(
        ExampleIntegration,
        "get_stacktrace_link",
        return_value="https://github.com/repo/blob/a67ea84967ed1ec42844720d9daf77be36ff73b0/src/path/to/file.py",
    )
    @responses.activate
    def test_codecov_line_coverage_exception(self, mock_integration):
        self._caplog.set_level(logging.ERROR, logger="sentry")
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/example/getsentry/repos/sentry/file_report/src/path/to/file.py",
            status=500,
            content_type="application/json",
        )

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={
                "file": self.filepath,
                "absPath": "abs_path",
                "module": "module",
                "package": "package",
                "commitId": "a67ea84967ed1ec42844720d9daf77be36ff73b0",
            },
        )

        assert self._caplog.record_tuples == [
            (
                "sentry.integrations.utils.codecov",
                logging.ERROR,
                "Codecov HTTP error: 500. Continuing execution.",
            )
        ]


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

    def test_multiple_code_mapping_matches(self):
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
