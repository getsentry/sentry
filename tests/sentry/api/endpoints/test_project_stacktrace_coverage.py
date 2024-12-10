import logging
from unittest.mock import patch

import pytest
import responses

from sentry import options
from sentry.integrations.example.integration import ExampleIntegration
from tests.sentry.issues.endpoints.test_project_stacktrace_link import BaseProjectStacktraceLink


class ProjectStacktraceLinkTestCodecov(BaseProjectStacktraceLink):
    endpoint = "sentry-api-0-project-stacktrace-coverage"

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
    def test_codecov_not_enabled(self, mock_integration):
        self.organization.flags.codecov_access = False
        self.organization.save()
        response = self.get_error_response(
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

        assert response.data["detail"] == "Codecov not enabled"

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

        assert response.data["lineCoverage"] == self.expected_line_coverage
        assert response.data["status"] == 200

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
        assert response.data["lineCoverage"] == self.expected_line_coverage
        assert response.data["status"] == 200

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
                "Codecov HTTP error: 500",
            )
        ]
