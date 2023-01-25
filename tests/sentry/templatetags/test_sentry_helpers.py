import datetime

import pytest
from django.template import engines

from sentry.models.organization import Organization
from sentry.testutils.helpers.features import Feature


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
    "input,output",
    (
        ("{% org_url organization '/issues/' %}", "http://testserver/issues/"),
        (
            "{% org_url organization '/issues/' query='referrer=alert' %}",
            "http://testserver/issues/?referrer=alert",
        ),
        (
            "{% org_url organization '/issues/' query='referrer=alert' fragment='test' %}",
            "http://testserver/issues/?referrer=alert#test",
        ),
        ("{% org_url organization path %}", "http://testserver/organizations/sentry/issues/"),
    ),
)
def test_org_url(input, output):
    prefix = "{% load sentry_helpers %}"
    org = Organization(id=1, slug="sentry", name="Sentry")
    result = (
        engines["django"]
        .from_string(prefix + input)
        .render(context={"organization": org, "path": "/organizations/sentry/issues/"})
        .strip()
    )
    assert result == output


@pytest.mark.parametrize(
    "input,output",
    (
        (
            "{% org_url organization '/organizations/sentry/discover/' %}",
            "http://sentry.testserver/discover/",
        ),
        (
            "{% org_url organization path query='referrer=alert' %}",
            "http://sentry.testserver/issues/?referrer=alert",
        ),
    ),
)
def test_org_url_customer_domains(input, output):
    prefix = "{% load sentry_helpers %}"
    org = Organization(id=1, slug="sentry", name="Sentry")

    with Feature("organizations:customer-domains"):
        result = (
            engines["django"]
            .from_string(prefix + input)
            .render(context={"organization": org, "path": "/organizations/sentry/issues/"})
            .strip()
        )
        assert result == output


def test_querystring():
    input = """
    {% load sentry_helpers %}
    {% querystring transaction="testing" referrer="weekly_report" space="some thing"%}
    """
    result = engines["django"].from_string(input).render(context={}).strip()
    assert result == "transaction=testing&amp;referrer=weekly_report&amp;space=some+thing"


def test_date_handle_date_and_datetime():
    result = (
        engines["django"]
        .from_string(
            """
{% load sentry_helpers %}
{{ date_obj|date:"Y-m-d" }}
{{ datetime_obj|date:"Y-m-d" }}
            """
        )
        .render(
            context={
                "date_obj": datetime.date(2021, 4, 16),
                "datetime_obj": datetime.datetime(2021, 4, 17, 12, 13, 14),
            }
        )
        .strip()
    )

    assert result == "\n".join(["2021-04-16", "2021-04-17"])


@pytest.mark.parametrize(
    "a_dict,key,expected",
    (
        ({}, "", ""),
        ({}, "hi", ""),
        ({"hello": 1}, "hello", "1"),
    ),
)
def test_get_item(a_dict, key, expected):
    prefix = '{% load sentry_helpers %} {{ something|get_item:"' + key + '" }}'
    result = engines["django"].from_string(prefix).render(context={"something": a_dict}).strip()
    assert result == expected
