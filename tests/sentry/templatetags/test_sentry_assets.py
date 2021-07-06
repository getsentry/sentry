import pytest
from django.template import engines
from django.test import RequestFactory


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
