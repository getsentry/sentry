import pytest

from django.test import RequestFactory
from django.template import engines

from sentry.testutils import TestCase


class AssetsTest(TestCase):
    TEMPLATE = engines["django"].from_string(
        """
        {% load sentry_assets %}
        {% locale_js_include %}
    """
    )

    def test_supported_foreign_lang(self):
        request = RequestFactory().get("/")
        request.LANGUAGE_CODE = "fr"  # French, in locale/catalogs.json
        result = self.TEMPLATE.render(request=request)

        assert '<script src="/_static/{version}/sentry/dist/locale/fr.js"></script>' in result

    def test_supported_foreign_lang_csp_nonce(self):
        request = RequestFactory().get("/")
        request.LANGUAGE_CODE = "fr"  # French, in locale/catalogs.json
        request.csp_nonce = "r@nD0m"
        result = self.TEMPLATE.render(request=request)

        assert (
            '<script src="/_static/{version}/sentry/dist/locale/fr.js" nonce="r@nD0m"></script>'
            in result
        )

    def test_unsupported_foreign_lang(self):
        request = RequestFactory().get("/")
        request.LANGUAGE_CODE = "ro"  # Romanian, not in locale/catalogs.json

        result = self.TEMPLATE.render(request=request)

        assert result.strip() == ""

    def test_english(self):
        request = RequestFactory().get("/")
        request.LANGUAGE_CODE = "en"
        result = self.TEMPLATE.render(request=request)

        assert result.strip() == ""

    def test_no_lang(self):
        request = RequestFactory().get("/")
        result = self.TEMPLATE.render(request=request)

        assert result.strip() == ""


@pytest.mark.parametrize(
    "input, output",
    (
        # Basic nothing fancy
        ('{% script %}alert("hi"){% endscript %}', '<script>alert("hi")</script>'),
        # Whitespace should be stripped.
        ('{% script %}  alert("hi")  {% endscript %}', '<script>alert("hi")</script>'),
        # Attributes can be set.
        ('{% script async=True %}alert("hi"){% endscript %}', '<script async>alert("hi")</script>'),
        # Script tags can still be used for syntax highlighting
        (
            '{% script async=True %}<script>alert("hi")</script>{% endscript %}',
            '<script async>alert("hi")</script>',
        ),
    ),
)
def test_script_no_context(input, output):
    prefix = "{% load sentry_assets %}"
    result = engines["django"].from_string(prefix + input).render(context={}).strip()
    assert result == output


@pytest.mark.parametrize(
    "input, output",
    (
        # Basic nothing fancy
        ('{% script %}alert("hi"){% endscript %}', '<script nonce="r@nD0m">alert("hi")</script>'),
        # Basic with attributes
        (
            '{% script async=True defer=True type="text/javascript" %}alert("hi"){% endscript %}',
            '<script async defer nonce="r@nD0m" type="text/javascript">alert("hi")</script>',
        ),
        # Wrap script tag used for highlighting
        (
            """
        {% script async=True defer=True type="text/javascript" %}
        <script>alert("hi")</script>
        {% endscript %}""",
            '<script async defer nonce="r@nD0m" type="text/javascript">alert("hi")</script>',
        ),
        # Content with newlines and whitespace.
        (
            """
        {% script %}
        <script>
        alert("hi")
        </script>
        {% endscript %}""",
            '<script nonce="r@nD0m">alert("hi")</script>',
        ),
        # src with static string
        (
            '{% script src="/app.js" %}{% endscript %}',
            '<script nonce="r@nD0m" src="/app.js"></script>',
        ),
        # src with variable string name
        (
            "{% script src=url_path %}{% endscript %}",
            '<script nonce="r@nD0m" src="/asset.js"></script>',
        ),
        # src with variable string name
        (
            "{% script src=url_path|upper %}{% endscript %}",
            '<script nonce="r@nD0m" src="/ASSET.JS"></script>',
        ),
    ),
)
def test_script_context(input, output):
    request = RequestFactory().get("/")
    request.csp_nonce = "r@nD0m"

    prefix = "{% load sentry_assets %}"
    result = (
        engines["django"]
        .from_string(prefix + input)
        .render(context={"request": request, "url_path": "/asset.js"})
        .strip()
    )
    assert result == output
