from __future__ import absolute_import

from django.template import Context, Template
from mock import Mock

from sentry.testutils import TestCase


class AssetsTest(TestCase):
    TEMPLATE = Template(
        """
        {% load sentry_assets %}
        {% locale_js_include %}
    """
    )

    def test_supported_foreign_lang(self):
        # in Django 1.9+, simple_tag escapes the output by default.
        # To keep this test readable, we set autoescape=False.
        # If this rendering is safe, then we could mark_safe.
        result = self.TEMPLATE.render(
            Context(
                {"request": Mock(LANGUAGE_CODE="fr")}, autoescape=False
            )  # French, in locale/catalogs.json
        )

        assert '<script src="/_static/{version}/sentry/dist/locale/fr.js"></script>' in result

    def test_unsupported_foreign_lang(self):
        result = self.TEMPLATE.render(
            Context({"request": Mock(LANGUAGE_CODE="ro")})  # Romanian, not in locale/catalogs.json
        )

        assert result.strip() == ""

    def test_english(self):
        result = self.TEMPLATE.render(Context({"request": Mock(LANGUAGE_CODE="en")}))

        assert result.strip() == ""

    def test_no_lang(self):
        result = self.TEMPLATE.render(Context({"request": Mock()}))

        assert result.strip() == ""
