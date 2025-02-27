from __future__ import annotations

import pytest

from sentry.integrations.pagerduty.utils import sanitize_routing_key


@pytest.mark.parametrize(
    "input_key,expected",
    [
        (" abc123 ", "abc123"),  # Basic whitespace
        ("'abc123'", "abc123"),  # Single quotes
        ('"abc123"', "abc123"),  # Double quotes
        (" 'abc123' ", "abc123"),  # Both whitespace and quotes
        ("abc123", "abc123"),  # Already clean
        (
            " '46e00c51d3c54438b803b9a947d9d5db ' ",
            "46e00c51d3c54438b803b9a947d9d5db",
        ),  # Real example
    ],
)
def test_sanitize_routing_key(input_key: str, expected: str) -> None:
    assert sanitize_routing_key(input_key) == expected
