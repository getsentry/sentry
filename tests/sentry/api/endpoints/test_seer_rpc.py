from typing import Any

import orjson
from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.seer_rpc import (
    generate_request_signature,
    get_issues_with_event_details_for_file,
)
from sentry.integrations.github.constants import STACKFRAME_COUNT
from sentry.testutils.cases import APITestCase
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
            timestamp=before_now(days=15).isoformat(), filenames=["bar.py", "baz.py"]
        ).group.id

        issues = get_issues_with_event_details_for_file([self.project], ["baz.py"], ["world"])
        issue_ids = [issue["id"] for issue in issues]
        assert group_id != self.group_id
        assert issue_ids == [self.group_id]
