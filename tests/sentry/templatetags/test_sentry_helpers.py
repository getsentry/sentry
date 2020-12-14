from __future__ import absolute_import

import pytest
from django.test import RequestFactory
from django.template import engines


def test_system_origin():
    result = (
        engines["django"]
        .from_string(
            """
        {% load sentry_helpers %}
        {% system_origin %}
    """
        )
        .render()
        .strip()
    )

    assert result == "http://testserver"


@pytest.mark.parametrize(
    "input,output",
    (
        # Empty tag
        ("{% absolute_uri %}", "http://testserver"),
        # Basic, no variables
        ("{% absolute_uri '/matt/' %}", "http://testserver/matt/"),
        # String substitution
        ("{% absolute_uri '/{}/' 'matt' %}", "http://testserver/matt/"),
        # String substitution with variable
        ("{% absolute_uri '/{}/' who %}", "http://testserver/matt/"),
        # String substitution with missing variable
        ("{% absolute_uri '/foo/x{}/' xxx %}", "http://testserver/foo/x/"),
        # String substitution with multiple vars
        ("{% absolute_uri '/{}/{}/' who desc %}", "http://testserver/matt/awesome/"),
        # Empty tag, as other var
        ("{% absolute_uri as uri %}hello {{ uri }}!", "hello http://testserver!"),
        # Basic, as other var
        ("{% absolute_uri '/matt/' as uri %}hello {{ uri }}!", "hello http://testserver/matt/!"),
        # String substitution, as other var
        (
            "{% absolute_uri '/{}/' 'matt' as uri %}hello {{ uri }}!",
            "hello http://testserver/matt/!",
        ),
        # String substitution with variable, as other var
        ("{% absolute_uri '/{}/' who as uri %}hello {{ uri }}!", "hello http://testserver/matt/!"),
        # Mix it all up
        (
            "{% absolute_uri '/{}/{}/x{}/{}/' who 'xxx' nope desc as uri %}hello {{ uri }}!",
            "hello http://testserver/matt/xxx/x/awesome/!",
        ),
    ),
)
def test_absolute_uri(input, output):
    prefix = "{% load sentry_helpers %}"
    result = (
        engines["django"]
        .from_string(prefix + input)
        .render(context={"who": "matt", "desc": "awesome"})
        .strip()
    )
    assert result == output


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
    prefix = "{% load sentry_helpers %}"
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
    ),
)
def test_script_context(input, output):
    request = RequestFactory().get("/")
    request.csp_nonce = "r@nD0m"

    prefix = "{% load sentry_helpers %}"
    result = (
        engines["django"]
        .from_string(prefix + input)
        .render(context={"request": request, "url_path": "/asset.js"})
        .strip()
    )
    assert result == output
