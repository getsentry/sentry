from __future__ import absolute_import

from django.template import engines

from sentry.testutils import TestCase


class FeaturesTest(TestCase):
    # get a backend-dependent Template, just like get_template in >= Django 1.8
    TEMPLATE = engines["django"].from_string(
        """
        {% load sentry_features %}
        {% feature auth:register %}
            <span>register</span>
        {% else %}
            <span>nope</span>
        {% endfeature %}
    """
    )

    def test_enabled(self):
        with self.feature("auth:register"):
            result = self.TEMPLATE.render()
            assert "<span>register</span>" in result

    def test_disabled(self):
        with self.feature({"auth:register": False}):
            result = self.TEMPLATE.render()
            assert "<span>nope</span>" in result
