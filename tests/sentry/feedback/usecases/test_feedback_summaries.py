import pytest

from sentry.feedback.usecases.feedback_summaries import parse_response


def test_parse_response_valid():
    response = "Summary: This is a test summary"
    summary = parse_response(response)
    assert summary == "This is a test summary"


def test_parse_response_valid_extra_whitespace():
    response = """Summary:   This is a test  summary.

    And this is a       continuation of the
    summary."""
    summary = parse_response(response)
    assert summary == "This is a test summary. And this is a continuation of the summary."


def test_parse_response_response_invalid():
    invalid_response = "This is not a valid summary"

    with pytest.raises(ValueError, match="Failed to parse AI feedback summary response"):
        parse_response(invalid_response)
