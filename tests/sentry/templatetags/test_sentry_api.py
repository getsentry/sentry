from __future__ import absolute_import

from django.template import Context, Template

from sentry.testutils import TestCase


class SerializeDetailedOrgTest(TestCase):
    TEMPLATE = Template("""
        {% load sentry_api %}
        {% serialize_detailed_org org %}
    """)

    def test_escapes_js(self):
        org = self.create_organization(name='<script>alert(1);</script>')

        result = self.TEMPLATE.render(Context({
            'org': org,
        }))

        assert '<script>' not in result
        assert '\u003cscript\u003ealert(1);\u003c/script\u003e' in result
