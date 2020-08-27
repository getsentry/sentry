from __future__ import absolute_import

import pytest
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
