from typing import Any

import orjson
from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.seer_rpc import (
    _get_issues_with_event_details_for_file,
    generate_request_signature,
)
from sentry.testutils.cases import APITestCase
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


class TestGetIssuesRelatedToFilePatches(CreateEventTestCase):
    def setUp(self):
        self.group_id = [self._create_event(user_id=str(i)) for i in range(6)][0].group.id

    def test_simple(self):
        group_id = [
            self._create_event(function_names=["blue", "planet"], user_id=str(i)) for i in range(7)
        ][0].group.id
        issues_with_event_details = _get_issues_with_event_details_for_file(
            projects=[self.project],
            sentry_filenames=["baz.py"],
            function_names=["world", "planet"],
        )

        issue_ids = [issue["id"] for issue in issues_with_event_details]
        function_names = [issue["function_name"] for issue in issues_with_event_details]
        assert issue_ids == [group_id, self.group_id]
        assert function_names == ["planet", "world"]
