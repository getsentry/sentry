from sentry.feedback.usecases.feedback_summaries import parse_response


def test_parse_response_valid():
    response = "This is a test summary"
    summary = parse_response(response)
    assert summary == "This is a test summary"


def test_parse_response_valid_extra_whitespace():
    response = """   This is a test  summary.

    And this is a       continuation of the
    summary."""
    summary = parse_response(response)
    assert summary == "This is a test summary. And this is a continuation of the summary."
