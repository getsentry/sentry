from __future__ import absolute_import

from django.template import Context, Template
from mock import Mock

from sentry.testutils import TestCase


class AssetsTest(TestCase):
    TEMPLATE = Template("""
        {% load sentry_assets %}
        {% locale_js_include %}
    """)

    def test_supported_foreign_lang(self):
        result = self.TEMPLATE.render(Context({
            'request': Mock(LANGUAGE_CODE='fr'),  # French, in locale/catalogs.json
        }))

        assert '<script src="/_static/{version}/sentry/dist/locale/fr.js"></script>' in result

    def test_unsupported_foreign_lang(self):
        result = self.TEMPLATE.render(Context({
            'request': Mock(LANGUAGE_CODE='ro'),  # Romanian, not in locale/catalogs.json
        }))

        assert result.strip() == ''

    def test_english(self):
        result = self.TEMPLATE.render(Context({
            'request': Mock(LANGUAGE_CODE='en'),
        }))

        assert result.strip() == ''

    def test_no_lang(self):
        result = self.TEMPLATE.render(Context({
            'request': Mock(),
        }))

        assert result.strip() == ''
