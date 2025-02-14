from typing import Any
from unittest.mock import Mock, patch

import orjson
from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.seer_rpc import (
    NUM_DAYS_AGO,
    _add_event_details,
    generate_request_signature,
    get_issues_related_to_file_patches,
    get_issues_with_event_details_for_file,
)
from sentry.integrations.github.constants import STACKFRAME_COUNT
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.integrations.github.tasks.test_open_pr_comment import CreateEventTestCase


@override_settings(SEER_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestSeerRpc(APITestCase):
    @staticmethod
    def _get_path(method_name: str) -> str:
        return reverse(
            "sentry-api-0-seer-rpc-service",
            kwargs={"method_name": method_name},
        )

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = orjson.dumps(data).decode()
        signature = generate_request_signature(path, data.encode())

        return f"rpcsignature {signature}"

    def test_invalid_endpoint(self):
        path = self._get_path("not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def test_404(self):
        path = self._get_path("get_organization_slug")
        data: dict[str, Any] = {"args": {"org_id": 1}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 404


class TestGetIssuesWithEventDetailsForFile(CreateEventTestCase):
    def setUp(self):
        self.group_id = [self._create_event(user_id=str(i)) for i in range(6)][0].group.id

    def test_simple(self):
        group_id = [
            self._create_event(function_names=["blue", "planet"], user_id=str(i)) for i in range(7)
        ][0].group.id
        issues_with_event_details = get_issues_with_event_details_for_file(
            projects=[self.project],
            sentry_filenames=["baz.py"],
            function_names=["world", "planet"],
        )

        issue_ids = [issue["id"] for issue in issues_with_event_details]
        function_names = [issue["function_name"] for issue in issues_with_event_details]
        assert group_id != self.group_id
        assert set(issue_ids) == {group_id, self.group_id}
        assert set(function_names) == {"planet", "world"}

    def test_filename_mismatch(self):
        group_id = self._create_event(
            filenames=["foo.py", "bar.py"],
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_function_name_mismatch(self):
        group_id = self._create_event(
            function_names=["world", "hello"],
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_not_first_frame(self):
        group_id = self._create_event(
            function_names=["world", "hello"], filenames=["baz.py", "bar.py"], culprit="hi"
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        function_names = [issue["function_name"] for issue in issues]
        assert group_id != self.group_id
        assert set(issue_ids) == {self.group_id, group_id}
        assert function_names == ["world", "world"]

    def test_not_within_frame_limit(self):
        function_names = ["world"] + ["a" for _ in range(STACKFRAME_COUNT)]
        filenames = ["baz.py"] + ["foo.py" for _ in range(STACKFRAME_COUNT)]
        group_id = self._create_event(function_names=function_names, filenames=filenames).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]

    def test_event_too_old(self):
        group_id = self._create_event(
            timestamp=before_now(days=NUM_DAYS_AGO + 1).isoformat(), filenames=["bar.py", "baz.py"]
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]


class TestGetIssuesRelatedToFilePatches(IntegrationTestCase, CreateEventTestCase):
    base_url = "https://api.github.com"

    def setUp(self):
        self.user_id = "user_1"
        self.app_id = "app_1"

        self.group_id_1 = [self._create_event(culprit="issue1", user_id=str(i)) for i in range(5)][
            0
        ].group.id
        self.group_id_2 = [
            self._create_event(
                culprit="issue2",
                filenames=["foo.py", "bar.py"],
                function_names=["blue", "planet"],
                user_id=str(i),
            )
            for i in range(6)
        ][0].group.id

        self.gh_repo: Repository = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )

        groups: list[Group] = list(Group.objects.all())
        issues_result_set = []
        for group_num, group in enumerate(groups):
            event = group.get_latest_event()
            assert event is not None
            issues_result_set.append(
                {
                    "group_id": group.id,
                    "event_id": event.event_id,
                    "title": f"title_{group_num}",
                    "function_name": f"function_{group_num}",
                }
            )
        self.issues_with_event_details = _add_event_details(
            projects=[self.project],
            issues_result_set=issues_result_set,
            event_timestamp_start=None,
            event_timestamp_end=None,
        )

    @patch("sentry.api.endpoints.seer_rpc.get_projects_and_filenames_from_source_file")
    @patch(
        "sentry.integrations.github.tasks.language_parsers.PythonParser.extract_functions_from_patch"
    )
    @patch("sentry.api.endpoints.seer_rpc.get_issues_with_event_details_for_file")
    def test_get_issues_related_to_file_patches(
        self,
        mock_get_issues_with_event_details_for_file: Mock,
        mock_extract_functions_from_patch: Mock,
        mock_get_projects_and_filenames_from_source_file: Mock,
    ):
        mock_get_issues_with_event_details_for_file.side_effect = (
            lambda *args, **kwargs: self.issues_with_event_details
        )
        mock_extract_functions_from_patch.return_value = ["world", "planet"]
        mock_get_projects_and_filenames_from_source_file.return_value = ({self.project}, {"foo.py"})

        filename_to_patch = {"foo.py": "a", "bar.py": "b"}
        filename_to_issues_expected = {
            filename: self.issues_with_event_details for filename in filename_to_patch
        }

        assert self.gh_repo.provider is not None

        filename_to_issues = get_issues_related_to_file_patches(
            organization_id=self.organization.id,
            provider=self.gh_repo.provider,
            external_id=self.gh_repo.external_id,  # type: ignore[arg-type]
            filename_to_patch=filename_to_patch,
        )
        assert filename_to_issues == filename_to_issues_expected
