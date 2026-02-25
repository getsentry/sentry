from __future__ import annotations

from functools import cached_property

from sentry.plugins.base import plugins
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class GroupPluginActionViewTest(TestCase):
    @cached_property
    def path(self) -> str:
        return f"/{self.organization.slug}/{self.project.slug}/issues/{self.group.id}/actions/{self.plugin_slug}/"

    def setUp(self) -> None:
        super().setUp()
        self.plugin_slug = "webhooks"
        min_ago = before_now(minutes=1).isoformat()
        self.event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.group = self.event.group
        self.login_as(self.user)

    def test_disabled_plugin_returns_404(self) -> None:
        plugin = plugins.get(self.plugin_slug)
        plugin.disable(self.project)

        resp = self.client.get(self.path)
        assert resp.status_code == 404

    def test_enabled_plugin_does_not_return_404(self) -> None:
        plugin = plugins.get(self.plugin_slug)
        plugin.enable(self.project)

        resp = self.client.get(self.path)
        assert resp.status_code != 404
