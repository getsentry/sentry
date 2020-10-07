from __future__ import absolute_import

import hmac

from django.core.urlresolvers import reverse
from exam import fixture
from hashlib import sha256
from sentry.utils.compat.mock import patch

from sentry.models import ProjectOption
from sentry.testutils import TestCase
from sentry.utils import json


class ReleaseWebhookTestBase(TestCase):
    def setUp(self):
        super(ReleaseWebhookTestBase, self).setUp()
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team])
        self.token = "a2587e3af83411e4a28634363b8514c2"
        ProjectOption.objects.set_value(self.project, "sentry:release-token", self.token)

    @fixture
    def signature(self):
        return hmac.new(
            key=self.token.encode("utf-8"),
            msg=("{}-{}".format(self.plugin_id, self.project.id)).encode("utf-8"),
            digestmod=sha256,
        ).hexdigest()

    @fixture
    def path(self):
        return reverse(
            "sentry-release-hook",
            kwargs={
                "project_id": self.project.id,
                "plugin_id": self.plugin_id,
                "signature": self.signature,
            },
        )


class ReleaseWebhookTest(ReleaseWebhookTestBase):
    def setUp(self):
        super(ReleaseWebhookTest, self).setUp()
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


class BuiltinReleaseWebhookTest(ReleaseWebhookTestBase):
    def setUp(self):
        super(BuiltinReleaseWebhookTest, self).setUp()
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
