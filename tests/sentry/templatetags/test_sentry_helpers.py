from __future__ import absolute_import

from django.template import Context, Template


def test_system_origin():
    result = Template("""
        {% load sentry_helpers %}
        {% system_origin %}
    """).render(Context()).strip()

    assert result == 'http://testserver'
