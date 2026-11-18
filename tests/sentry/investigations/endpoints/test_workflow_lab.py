from unittest.mock import patch
from uuid import uuid4

import orjson
from django.test import override_settings
from django.urls import reverse
from urllib3.response import HTTPResponse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import decode_viewer_context

POOL = "sentry.investigations.endpoints.workflow_lab.seer_autofix_default_connection_pool"


@with_feature("organizations:investigations")
class OrganizationWorkflowLabTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-lab"

    @override_settings(
        DEBUG=True, SEER_API_SHARED_SECRET="workflow-lab-test-key-for-signed-requests"
    )
    def test_signed_run_and_status(self):
        self.login_as(self.user)
        run_id = str(uuid4())
        accepted = {"id": run_id, "notebook": True}
        draft = {"workflow": {"notebook": True}, "input": {}, "requestId": str(uuid4())}
        with patch(POOL) as pool:
            pool.scheme, pool.host, pool.port = "http", "localhost", 9091
            pool.urlopen.return_value = HTTPResponse(body=orjson.dumps(accepted), status=200)
            response = self.get_success_response(
                self.organization.slug, method="post", action="run", **draft
            )
            assert response.data == accepted
            args, kwargs = pool.urlopen.call_args
            assert args == ("POST", "/v1/automation/workflow-lab/runs")
            viewer = decode_viewer_context(
                kwargs["headers"]["X-Viewer-Context"],
                key="workflow-lab-test-key-for-signed-requests",
            )
            assert viewer.organization_id == self.organization.id
            assert viewer.actor.actor_id == self.user.id
            assert orjson.loads(kwargs["body"]) == draft
            url = reverse(
                "sentry-api-0-organization-workflow-lab-run", args=[self.organization.slug, run_id]
            )
            pool.urlopen.return_value = HTTPResponse(body=b'{"notebookId":"12"}', status=200)
            result = self.client.get(url, {"activity": "1"})
            assert result.data["notebookId"] == "12"
            assert pool.urlopen.call_args.args == (
                "GET",
                f"/v1/automation/workflow-lab/runs/{run_id}?activity=true",
            )
            assert self.client.post(url, {"command": "cancel"}, format="json").status_code == 200
            assert pool.urlopen.call_args.args == (
                "POST",
                f"/v1/automation/workflow-lab/runs/{run_id}/commands",
            )

    @override_settings(DEBUG=False)
    def test_development_only(self):
        self.login_as(self.user)
        with patch(POOL) as pool:
            self.get_error_response(self.organization.slug, status_code=404)
            pool.urlopen.assert_not_called()
