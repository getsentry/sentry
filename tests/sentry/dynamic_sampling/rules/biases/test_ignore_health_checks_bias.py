import fnmatch

import pytest

from sentry.constants import HEALTH_CHECK_GLOBS
from sentry.dynamic_sampling.rules.biases.ignore_health_checks_bias import (
    IgnoreHealthChecksTraceBias,
    IgnoreHealthChecksTransactionBias,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_generate_bias_rules_v2(default_project) -> None:
    rules = IgnoreHealthChecksTransactionBias().generate_rules(
        project=default_project, base_sample_rate=1.0
    )
    assert rules == [
        {
            "condition": {
                "inner": [
                    {
                        "name": "event.transaction",
                        "op": "glob",
                        "value": HEALTH_CHECK_GLOBS,
                    }
                ],
                "op": "or",
            },
            "id": 1002,
            "samplingValue": {"type": "sampleRate", "value": 0.2},
            "type": "transaction",
        }
    ]


@django_db_all
def test_generate_trace_bias_rules(default_project) -> None:
    rules = IgnoreHealthChecksTraceBias().generate_rules(
        project=default_project, base_sample_rate=1.0
    )
    assert rules == [
        {
            "condition": {
                "inner": [
                    {
                        "name": "trace.transaction",
                        "op": "glob",
                        "value": HEALTH_CHECK_GLOBS,
                    }
                ],
                "op": "or",
            },
            "id": 1002,
            "samplingValue": {"type": "sampleRate", "value": 0.2},
            "type": "trace",
        }
    ]


def expand_glob_for_fnmatch(pattern: str) -> list[str]:
    """
    Expand glob patterns for fnmatch compatibility.

    Handles:
    - {/,} brace expansion (either / or empty string)
    - \\[ and \\] escaped brackets -> [[] and []] for fnmatch literal bracket matching
    """
    # Convert escaped brackets to fnmatch-compatible literal brackets
    # In Relay globs, \[ and \] mean literal brackets
    # In fnmatch, [[] matches literal [ and []] matches literal ]
    pattern = pattern.replace(r"\[", "[[]").replace(r"\]", "[]]")

    # Expand {/,} brace syntax
    if "{/,}" in pattern:
        return [pattern.replace("{/,}", "/"), pattern.replace("{/,}", "")]
    return [pattern]


def matches_health_check_globs(transaction_name: str) -> bool:
    """Check if a transaction name matches any of the health check glob patterns."""
    for glob in HEALTH_CHECK_GLOBS:
        for expanded in expand_glob_for_fnmatch(glob):
            if fnmatch.fnmatch(transaction_name, expanded):
                return True
    return False


@pytest.mark.parametrize(
    "transaction_name,expected_glob",
    [
        # Pattern: *healthcheck*
        ("/healthcheck", "*healthcheck*"),
        ("/healthcheck/", "*healthcheck*"),
        ("/api/healthcheck", "*healthcheck*"),
        ("/api/healthcheck/status", "*healthcheck*"),
        ("GET /healthcheck", "*healthcheck*"),
        ("GET /api/v1/healthcheck", "*healthcheck*"),
        ("healthcheck", "*healthcheck*"),
        ("my-service-healthcheck", "*healthcheck*"),
        ("healthcheck-endpoint", "*healthcheck*"),
        # Pattern: *heartbeat*
        ("/heartbeat", "*heartbeat*"),
        ("/api/heartbeat", "*heartbeat*"),
        ("POST /heartbeat", "*heartbeat*"),
        ("heartbeat", "*heartbeat*"),
        ("service-heartbeat-check", "*heartbeat*"),
        # Pattern: */health{/,}
        ("/api/health", "*/health{/,}"),
        ("/api/health/", "*/health{/,}"),
        ("GET /health", "*/health{/,}"),
        ("GET /health/", "*/health{/,}"),
        ("/v1/health", "*/health{/,}"),
        # Pattern: */healthy{/,}
        ("/api/healthy", "*/healthy{/,}"),
        ("/api/healthy/", "*/healthy{/,}"),
        ("GET /healthy", "*/healthy{/,}"),
        # Pattern: */healthz{/,}
        ("/api/healthz", "*/healthz{/,}"),
        ("/api/healthz/", "*/healthz{/,}"),
        ("GET /healthz", "*/healthz{/,}"),
        ("/k8s/healthz", "*/healthz{/,}"),
        # Pattern: */health_check{/,}
        ("/api/health_check", "*/health_check{/,}"),
        ("/api/health_check/", "*/health_check{/,}"),
        ("GET /health_check", "*/health_check{/,}"),
        # Pattern: */_health{/,}
        ("/api/_health", "*/_health{/,}"),
        ("/api/_health/", "*/_health{/,}"),
        ("GET /_health", "*/_health{/,}"),
        # Pattern: */\[_health\]{/,} (literal brackets)
        ("/api/[_health]", r"*/\[_health\]{/,}"),
        ("/api/[_health]/", r"*/\[_health\]{/,}"),
        ("GET /[_health]", r"*/\[_health\]{/,}"),
        # Pattern: */live{/,}
        ("/api/live", "*/live{/,}"),
        ("/api/live/", "*/live{/,}"),
        ("GET /live", "*/live{/,}"),
        ("/k8s/live", "*/live{/,}"),
        # Pattern: */livez{/,}
        ("/api/livez", "*/livez{/,}"),
        ("/api/livez/", "*/livez{/,}"),
        ("GET /livez", "*/livez{/,}"),
        # Pattern: */ready{/,}
        ("/api/ready", "*/ready{/,}"),
        ("/api/ready/", "*/ready{/,}"),
        ("GET /ready", "*/ready{/,}"),
        ("/k8s/ready", "*/ready{/,}"),
        # Pattern: */readyz{/,}
        ("/api/readyz", "*/readyz{/,}"),
        ("/api/readyz/", "*/readyz{/,}"),
        ("GET /readyz", "*/readyz{/,}"),
        # Pattern: */ping{/,}
        ("/api/ping", "*/ping{/,}"),
        ("/api/ping/", "*/ping{/,}"),
        ("GET /ping", "*/ping{/,}"),
        ("/monitoring/ping", "*/ping{/,}"),
        # Pattern: */up{/,}
        ("/api/up", "*/up{/,}"),
        ("/api/up/", "*/up{/,}"),
        ("GET /up", "*/up{/,}"),
        ("/status/up", "*/up{/,}"),
    ],
)
def test_health_check_globs_match_health_endpoints(
    transaction_name: str, expected_glob: str
) -> None:
    """Verify that actual health check endpoints are matched by the glob patterns."""
    assert matches_health_check_globs(
        transaction_name
    ), f"Expected '{transaction_name}' to match health check glob '{expected_glob}'"


@pytest.mark.parametrize(
    "transaction_name",
    [
        # Outbound requests to URLs where 'health' appears in the domain name - should NOT be filtered
        "PUT https://www.foobarhealth.com/api/add-new-insurance",
        "GET https://api.healthfirst.com/users",
        "POST https://healthdata.gov/submit",
        "GET https://myhealth.example.com/dashboard",
        "DELETE https://health-api.internal/records/123",
        # URLs where 'health' appears in the domain but path also contains slashes
        "GET https://www.foobarhealth.com/api/v1/patients",
        "POST https://healthservices.io/api/appointments",
        "PUT https://api.gethealth.co/users/profile",
        # Regular API endpoints that happen to contain health-related substrings in the path
        "GET /api/v1/users/health-records",
        "POST /api/healthcare/patients",
        "GET /api/mental-health/resources",
        "PUT /api/employee-health-benefits/update",
        # Other endpoints that should not be filtered
        "GET /api/users",
        "POST /api/orders",
        "/api/v1/transactions",
        "GET /dashboard",
        # Endpoints with similar but not matching patterns
        "/api/healthy-recipes",
        "/api/healthier-choices",
        "/pings",
        "/upload",
        "/readystate",
        "/livestream",
        # Real transaction names that might occur
        "myapp.tasks.process_health_data",
        "HealthController.getPatientInfo",
    ],
)
def test_health_check_globs_do_not_match_regular_endpoints(transaction_name: str) -> None:
    """Verify that regular endpoints and URLs containing 'health' in domain names are NOT filtered."""
    assert not matches_health_check_globs(
        transaction_name
    ), f"Expected '{transaction_name}' to NOT match health check globs"
