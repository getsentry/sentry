from unittest.mock import MagicMock

from django.template import engines

from sentry.plugins.base.v2 import Plugin2
from sentry.testutils.cases import PluginTestCase


class SamplePlugin(Plugin2):
    def get_actions(self, request, group):
        return [("Example Action", f"http://example.com?id={group.id}")]

    def get_annotations(self, group):
        return [
            {"label": "Example Tag", "url": f"http://example.com?id={group.id}"},
            {"label": "Example Two"},
        ]

    def is_enabled(self, project=None):
        return True


class GetActionsTest(PluginTestCase):
    plugin = SamplePlugin

    TEMPLATE = engines["django"].from_string(
        """
        {% load sentry_plugins %}
        {% for k, v in group|get_actions:request %}
            <span>{{ k }} - {{ v }}</span>
        {% endfor %}
    """
    )

    def test_includes_v2_plugins(self):
        group = self.create_group()
        result = self.TEMPLATE.render(context={"group": group}, request=MagicMock())

        assert f"<span>Example Action - http://example.com?id={group.id}</span>" in result


class GetAnnotationsTest(PluginTestCase):
    plugin = SamplePlugin

    TEMPLATE = engines["django"].from_string(
        """
        {% load sentry_plugins %}
        {% for a in group|get_annotations:request %}
            <span>{{ a.label }} - {{ a.url }}</span>
        {% endfor %}
    """
    )

    def test_includes_v2_plugins(self):
        group = self.create_group()
        result = self.TEMPLATE.render(context={"group": group}, request=MagicMock())

        assert f"<span>Example Tag - http://example.com?id={group.id}</span>" in result
        assert "<span>Example Two - None</span>" in result
