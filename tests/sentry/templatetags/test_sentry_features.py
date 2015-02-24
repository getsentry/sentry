from __future__ import absolute_import

from django.template import Context, Template
from mock import Mock

from sentry.testutils import TestCase


class FeaturesTest(TestCase):
    TEMPLATE = Template("""
        {% load sentry_features %}
        {% feature auth:register %}
            <span>register</span>
        {% else %}
            <span>nope</span>
        {% endfeature %}
    """)

    def test_enabled(self):
        with self.feature('auth:register'):
            result = self.TEMPLATE.render(Context({
                'request': Mock(),
            }))

        assert '<span>register</span>' in result

    def test_disabled(self):
        with self.feature('auth:register', False):
            result = self.TEMPLATE.render(Context({
                'request': Mock(),
            }))

        assert '<span>nope</span>' in result
