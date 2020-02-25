from __future__ import absolute_import

import pytest

from sentry.coreapi import APIError
from sentry.event_manager import EventManager
from sentry.utils.compat import map


def validate_and_normalize(report, client_ip="198.51.100.0", user_agent="Awesome Browser"):
    manager = EventManager(report, client_ip=client_ip, user_agent=user_agent)
    manager.process_csp_report()
    manager.normalize()
    return manager.get_data()


def _build_test_report(effective_directive, violated_directive):
    report = {
        "release": "abc123",
        "environment": "production",
        "interface": "csp",
        "report": {
            "csp-report": {
                "document-uri": "http://45.55.25.245:8123/csp",
                "referrer": "http://example.com",
                "violated-directive": violated_directive,
                "effective-directive": effective_directive,
                "original-policy": "default-src  https://45.55.25.245:8123/; child-src  https://45.55.25.245:8123/; connect-src  https://45.55.25.245:8123/; font-src  https://45.55.25.245:8123/; img-src  https://45.55.25.245:8123/; media-src  https://45.55.25.245:8123/; object-src  https://45.55.25.245:8123/; script-src  https://45.55.25.245:8123/; style-src  https://45.55.25.245:8123/; form-action  https://45.55.25.245:8123/; frame-ancestors 'none'; plugin-types 'none'; report-uri http://45.55.25.245:8123/csp-report?os=OS%20X&device=&browser_version=43.0&browser=chrome&os_version=Lion",
                "blocked-uri": "http://google.com",
                "status-code": 200,
            }
        },
    }
    if violated_directive is None:
        del report["report"]["csp-report"]["violated-directive"]
    if effective_directive is None:
        del report["report"]["csp-report"]["effective-directive"]

    return report


@pytest.mark.parametrize(
    "effective_directive,violated_directive,culprit_element",
    (
        ("img-src", "img-src https://45.55.25.245:8123/", "img-src"),
        ("img-src", "default-src https://45.55.25.245:8123/", "default-src"),
        # build a report without the effective-directive key
        (None, "img-src https://45.55.25.245:8123/", "img-src"),
    ),
    ids=(
        "directives match",
        "prefer effective-directive",
        "parse effective-directive from violated-directive",
    ),
)
def test_csp_validate(effective_directive, violated_directive, culprit_element):
    report = _build_test_report(effective_directive, violated_directive)
    result = validate_and_normalize(report)
    assert result["logger"] == "csp"
    assert result["release"] == "abc123"
    assert result["environment"] == "production"
    assert "errors" not in result
    assert "logentry" in result
    assert result["culprit"] == culprit_element + " 'self'"
    assert map(tuple, result["tags"]) == [
        ("effective-directive", "img-src"),
        ("blocked-uri", "http://google.com"),
    ]
    assert result["user"] == {"ip_address": "198.51.100.0"}
    assert result["request"]["url"] == "http://45.55.25.245:8123/csp"
    assert dict(result["request"]["headers"]) == {
        "User-Agent": "Awesome Browser",
        "Referer": "http://example.com",
    }


@pytest.mark.parametrize(
    "report",
    (
        {},
        {"release": "abc123", "interface": "csp", "report": {}},
        _build_test_report(effective_directive=None, violated_directive=None),
        _build_test_report(effective_directive=None, violated_directive=""),
        _build_test_report(effective_directive=None, violated_directive="blink-src"),
    ),
    ids=(
        "empty dict",
        "no csp-report",
        "no violated-directive to parse (expect KeyError)",
        "unsplittable violated-directive (expect IndexError)",
        "invalid violated-directive (not in schema enum)",
    ),
)
def test_csp_validate_failure(report):
    with pytest.raises(APIError):
        validate_and_normalize(report)


def test_csp_tags_out_of_bounds():
    report = {
        "release": "abc123",
        "interface": "csp",
        "report": {
            "csp-report": {
                "document-uri": "http://45.55.25.245:8123/csp",
                "referrer": "http://example.com",
                "violated-directive": "img-src https://45.55.25.245:8123/",
                "effective-directive": "img-src",
                "original-policy": "default-src  https://45.55.25.245:8123/; child-src  https://45.55.25.245:8123/; connect-src  https://45.55.25.245:8123/; font-src  https://45.55.25.245:8123/; img-src  https://45.55.25.245:8123/; media-src  https://45.55.25.245:8123/; object-src  https://45.55.25.245:8123/; script-src  https://45.55.25.245:8123/; style-src  https://45.55.25.245:8123/; form-action  https://45.55.25.245:8123/; frame-ancestors 'none'; plugin-types 'none'; report-uri http://45.55.25.245:8123/csp-report?os=OS%20X&device=&browser_version=43.0&browser=chrome&os_version=Lion",
                "blocked-uri": "v" * 201,
                "status-code": 200,
            }
        },
    }
    result = validate_and_normalize(report)
    assert result["tags"] == [["effective-directive", "img-src"], None]
    assert len(result["errors"]) == 1


def test_csp_tag_value():
    report = {
        "release": "abc123",
        "interface": "csp",
        "report": {
            "csp-report": {
                "document-uri": "http://45.55.25.245:8123/csp",
                "referrer": "http://example.com",
                "violated-directive": "img-src https://45.55.25.245:8123/",
                "effective-directive": "img-src",
                "original-policy": "default-src  https://45.55.25.245:8123/; child-src  https://45.55.25.245:8123/; connect-src  https://45.55.25.245:8123/; font-src  https://45.55.25.245:8123/; img-src  https://45.55.25.245:8123/; media-src  https://45.55.25.245:8123/; object-src  https://45.55.25.245:8123/; script-src  https://45.55.25.245:8123/; style-src  https://45.55.25.245:8123/; form-action  https://45.55.25.245:8123/; frame-ancestors 'none'; plugin-types 'none'; report-uri http://45.55.25.245:8123/csp-report?os=OS%20X&device=&browser_version=43.0&browser=chrome&os_version=Lion",
                "blocked-uri": "http://google.com",
                "status-code": 200,
            }
        },
    }
    result = validate_and_normalize(report)
    assert map(tuple, result["tags"]) == [
        ("effective-directive", "img-src"),
        ("blocked-uri", "http://google.com"),
    ]
    assert "errors" not in result


def test_hpkp_validate_basic():
    report = {
        "release": "abc123",
        "interface": "hpkp",
        "report": {
            "date-time": "2014-04-06T13:00:50Z",
            "hostname": "www.example.com",
            "port": 443,
            "effective-expiration-date": "2014-05-01T12:40:50Z",
            "include-subdomains": False,
            "served-certificate-chain": ["-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"],
            "validated-certificate-chain": [
                "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
            ],
            "known-pins": ['pin-sha256="E9CZ9INDbd+2eRQozYqqbQ2yXLVKB9+xcprMF+44U1g="'],
        },
    }
    result = validate_and_normalize(report)
    assert result["release"] == "abc123"
    assert "errors" not in result
    assert "logentry" in result
    assert not result.get("culprit")
    assert sorted(map(tuple, result["tags"])) == [
        ("hostname", "www.example.com"),
        ("include-subdomains", "false"),
        ("port", "443"),
    ]
    assert result["user"] == {"ip_address": "198.51.100.0"}
    expected_headers = [["User-Agent", "Awesome Browser"]]

    assert result["request"] == {"url": "www.example.com", "headers": expected_headers}


def test_hpkp_validate_failure():
    report = {"release": "abc123", "interface": "hpkp", "report": {}}
    with pytest.raises(APIError):
        validate_and_normalize(report)
