import hmac
from functools import cached_property
from hashlib import sha256
from unittest.mock import patch

from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


class ReleaseWebhookTestBase(TestCase):
    plugin_id: str

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team])
        self.token = "a2587e3af83411e4a28634363b8514c2"
        ProjectOption.objects.set_value(self.project, "sentry:release-token", self.token)

    @cached_property
    def signature(self):
        return hmac.new(
            key=self.token.encode("utf-8"),
            msg=(f"{self.plugin_id}-{self.project.id}").encode(),
            digestmod=sha256,
        ).hexdigest()

    @cached_property
    def path(self):
        return reverse(
            "sentry-release-hook",
            kwargs={
                "project_id": self.project.id,
                "plugin_id": self.plugin_id,
                "signature": self.signature,
            },
        )


@region_silo_test
class ReleaseWebhookTest(ReleaseWebhookTestBase):
    def setUp(self):
        super().setUp()
        self.plugin_id = "dummy"

    def test_no_token(self):
        project = self.create_project(teams=[self.team])
        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": project.id, "plugin_id": "dummy", "signature": self.signature},
        )
        resp = self.client.post(path)
        assert resp.status_code == 403

    def test_invalid_signature(self):
        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": self.project.id, "plugin_id": "dummy", "signature": "wrong"},
        )
        resp = self.client.post(path)
        assert resp.status_code == 403

    def test_invalid_project(self):
        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": 1000000, "plugin_id": "dummy", "signature": self.signature},
        )
        resp = self.client.post(path)
        assert resp.status_code == 404

    @patch("sentry.plugins.base.plugins.get")
    def test_valid_signature(self, mock_plugin_get):
        MockPlugin = mock_plugin_get.return_value
        MockPlugin.is_enabled.return_value = True
        MockReleaseHook = MockPlugin.get_release_hook.return_value
        resp = self.client.post(self.path)
        assert resp.status_code == 204
        mock_plugin_get.assert_called_once_with("dummy")
        MockPlugin.get_release_hook.assert_called_once_with()
        MockReleaseHook.assert_called_once_with(self.project)
        assert MockReleaseHook.return_value.handle.call_count == 1

    @patch("sentry.plugins.base.plugins.get")
    def test_disabled_plugin(self, mock_plugin_get):
        MockPlugin = mock_plugin_get.return_value
        MockPlugin.is_enabled.return_value = False
        resp = self.client.post(self.path)
        assert resp.status_code == 403
        mock_plugin_get.assert_called_once_with("dummy")
        assert not MockPlugin.get_release_hook.called


@region_silo_test
class BuiltinReleaseWebhookTest(ReleaseWebhookTestBase):
    def setUp(self):
        super().setUp()
        self.plugin_id = "builtin"

    def test_invalid_params(self):
        resp = self.client.post(self.path, content_type="application/json")
        assert resp.status_code == 400

    def test_valid_params(self):
        resp = self.client.post(
            self.path, data=json.dumps({"version": "a"}), content_type="application/json"
        )
        assert resp.status_code == 201, resp.content
        data = json.loads(resp.content)
        assert data["version"] == "a"
