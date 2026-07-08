import pytest

from sentry.issues.formatting import format_issue as exported_format_issue
from sentry.issues.formatting.limits import LIMITS_DEFAULT
from sentry.issues.formatting.profiles import DEFAULT_PROFILE, EVENT_SECTIONS, format_issue


def _serialized_event() -> dict:
    return {
        "eventID": "abc123",
        "title": "ValueError: boom",
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "boom",
                            "mechanism": {"handled": False},
                            "stacktrace": {
                                "frames": [{"function": "f", "filename": "a.py", "lineNo": 1}]
                            },
                        }
                    ]
                },
            },
            {"type": "breadcrumbs", "data": {"values": [{"message": "started"}]}},
        ],
    }


def test_format_issue_markdown_end_to_end() -> None:
    out = format_issue(_serialized_event(), format="markdown")
    assert "## Title\nValueError: boom" in out
    assert "## Exception" in out
    assert "**Handled:** No" in out
    assert "## Breadcrumbs" in out
    assert "started" in out


def test_format_issue_xml() -> None:
    out = format_issue(_serialized_event(), format="xml")
    assert "<title>" in out
    assert "<exception>" in out
    assert "<breadcrumbs>" in out


def test_invalid_format_raises() -> None:
    with pytest.raises(ValueError):
        format_issue(_serialized_event(), format="banana")  # type: ignore[arg-type]


def test_exported_from_package_root() -> None:
    # matches the doc's `from sentry.issues.formatting import format_issue`
    assert exported_format_issue is format_issue


def test_default_profile_wiring() -> None:
    # the single base profile: full event section list under default limits
    assert DEFAULT_PROFILE.sections is EVENT_SECTIONS
    assert DEFAULT_PROFILE.limits is LIMITS_DEFAULT
