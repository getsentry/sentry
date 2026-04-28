import textwrap

from sentry.tasks.seer.night_shift.issue_formatter import format_issue_output


def test_full_output_comprehensive() -> None:
    # Full populated Seer response: header with all fields, tag overview wrapped
    # in the nested {"tags_overview": {"tags_overview": [...]}} shape that the
    # Seer RPC actually returns, and mixed activity (assigned + note + system-
    # actor fallback).
    details = {
        "issue": {
            "shortId": "PROJ-123",
            "title": "ValueError: bad input",
            "culprit": "app.foo in bar",
            "issueType": "error",
            "issueCategory": "error",
            "issueTypeDescription": "Error",
            "level": "error",
            "priority": "high",
            "status": "unresolved",
            "substatus": "new",
            "firstSeen": "2026-01-01T00:00:00Z",
            "lastSeen": "2026-01-02T00:00:00Z",
            "count": 42,
            "userCount": 7,
            "platform": "python",
            "assignedTo": {"email": "alice@example.com"},
        },
        "tags_overview": {
            "tags_overview": [
                {
                    "key": "browser",
                    "name": "Browser",
                    "total_values": 100,
                    "unique_values": 3,
                    "top_values": [
                        {"value": "Chrome 120", "count": 70, "percentage": "70%"},
                        {"value": "Firefox 121", "count": 30, "percentage": "30%"},
                    ],
                }
            ],
        },
        "user_activity": [
            {
                "type": "assigned",
                "user": {"email": "bob@example.com"},
                "data": {"assigneeEmail": "carol@example.com"},
                "dateCreated": "2026-01-03T12:00:00Z",
            },
            {
                "type": "note",
                "user": {"username": "alice"},
                "data": {"text": "looks like a regression"},
                "dateCreated": "2026-01-03T13:00:00Z",
            },
            {"type": "set_resolved", "user": None, "dateCreated": "2026-01-04T00:00:00Z"},
        ],
    }

    output = format_issue_output(details)

    expected_header = textwrap.dedent(
        """
        # PROJ-123: ValueError: bad input
        **Culprit:** `app.foo in bar`
        **Type:** error / error — Error
        **Level:** error | **Priority:** high | **Status:** unresolved | **Substatus:** new
        **First seen:** 2026-01-01T00:00:00Z | **Last seen:** 2026-01-02T00:00:00Z
        **Events:** 42 | **Users affected:** 7
        **Assigned to:** alice@example.com
        **Platform:** python
        """
    ).strip()
    assert expected_header in output

    expected_tags_block = textwrap.dedent(
        """
        ## Tag Distribution

        **Browser** (`browser`) (100 total, 3 unique)
        - Chrome 120 — 70 (70%)
        - Firefox 121 — 30 (30%)
        """
    ).strip()
    assert expected_tags_block in output

    expected_activity_block = textwrap.dedent(
        """
        ## Recent Activity

        - 2026-01-03T12:00:00Z — bob@example.com (assigned): assigneeEmail=carol@example.com
        - 2026-01-03T13:00:00Z — alice (note): text=looks like a regression
        - 2026-01-04T00:00:00Z — system (set_resolved)
        """
    ).strip()
    assert expected_activity_block in output


def test_sparse_input_omits_missing_sections() -> None:
    # Minimal data: sparse issue, empty tag overview (missing inner key), empty
    # activity list. Optional sections should be silently omitted.
    output = format_issue_output(
        {
            "issue": {"shortId": "P-1", "title": "Oops"},
            "tags_overview": {},
            "user_activity": [],
        }
    )

    assert "# P-1: Oops" in output
    assert "Culprit" not in output
    assert "Type" not in output
    assert "Assigned to" not in output
    assert "## Tag Distribution" not in output
    assert "## Recent Activity" not in output
