from __future__ import absolute_import

from sentry.utils.compat.mock import MagicMock
from django.template import engines

from sentry.plugins.base.v2 import Plugin2
from sentry.testutils import PluginTestCase


class SamplePlugin(Plugin2):
    def get_actions(self, request, group):
        return [("Example Action", "http://example.com?id=%s" % (group.id,))]

    def get_annotations(self, group):
        return [
            {"label": "Example Tag", "url": "http://example.com?id=%s" % (group.id,)},
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

        assert "<span>Example Action - http://example.com?id=%s</span>" % (group.id,) in result


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

        assert "<span>Example Tag - http://example.com?id=%s</span>" % (group.id,) in result
        assert "<span>Example Two - None</span>" in result
