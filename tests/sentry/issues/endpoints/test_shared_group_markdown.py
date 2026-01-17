from sentry.issues.endpoints.shared_group_markdown import format_shared_issue_as_markdown
from sentry.testutils.cases import TestCase


class SharedGroupMarkdownFormatterTest(TestCase):
    def test_basic_issue_formatting(self) -> None:
        """Test basic issue markdown formatting with minimal data."""
        data = {
            "id": "123",
            "title": "Test Issue Title",
            "shortId": "TEST-1",
            "permalink": "https://sentry.io/organizations/test-org/issues/123/",
            "issueCategory": "error",
            "culprit": "test.function",
            "project": {
                "name": "Test Project",
                "slug": "test-project",
                "organization": {"name": "Test Org", "slug": "test-org"},
            },
            "latestEvent": {
                "id": "event123",
                "eventID": "event123",
                "platform": "python",
                "message": "Test error message",
            },
        }

        markdown = format_shared_issue_as_markdown(data)

        # Verify title
        assert "# Test Issue Title" in markdown

        # Verify issue ID
        assert "**Issue ID:** TEST-1" in markdown

        # Verify permalink
        assert "https://sentry.io/organizations/test-org/issues/123/" in markdown

        # Verify issue details
        assert "## Issue Details" in markdown
        assert "**Category:** error" in markdown
        assert "**Culprit:** `test.function`" in markdown

        # Verify project info
        assert "## Project" in markdown
        assert "**Name:** Test Project" in markdown
        assert "**Slug:** test-project" in markdown
        assert "**Organization:** Test Org" in markdown

        # Verify event info
        assert "## Latest Event" in markdown
        assert "**Event ID:** `event123`" in markdown
        assert "**Platform:** python" in markdown

    def test_exception_formatting(self) -> None:
        """Test exception entry formatting in markdown."""
        data = {
            "title": "Exception Test",
            "shortId": "TEST-2",
            "latestEvent": {
                "entries": [
                    {
                        "type": "exception",
                        "data": {
                            "values": [
                                {
                                    "type": "ValueError",
                                    "value": "Invalid value provided",
                                    "mechanism": {"type": "generic"},
                                    "stacktrace": {
                                        "frames": [
                                            {
                                                "filename": "app.py",
                                                "function": "main",
                                                "lineNo": 10,
                                                "context": "result = process(data)",
                                            },
                                            {
                                                "filename": "utils.py",
                                                "function": "process",
                                                "lineNo": 42,
                                                "context": "raise ValueError('Invalid value provided')",
                                            },
                                        ]
                                    },
                                }
                            ]
                        },
                    }
                ]
            },
        }

        markdown = format_shared_issue_as_markdown(data)

        # Verify exception formatting
        assert "#### Exception" in markdown
        assert "**Type:** ValueError" in markdown
        assert "**Value:** Invalid value provided" in markdown
        assert "**Mechanism:** generic" in markdown

        # Verify stack trace
        assert "at process (utils.py:42)" in markdown
        assert "at main (app.py:10)" in markdown
        assert "raise ValueError('Invalid value provided')" in markdown

    def test_request_entry_formatting(self) -> None:
        """Test request entry formatting in markdown."""
        data = {
            "title": "Request Error",
            "shortId": "TEST-3",
            "latestEvent": {
                "entries": [
                    {
                        "type": "request",
                        "data": {
                            "url": "https://example.com/api/endpoint",
                            "method": "POST",
                            "queryString": "param1=value1&param2=value2",
                            "headers": {
                                "User-Agent": "Mozilla/5.0",
                                "Content-Type": "application/json",
                                "Authorization": "Bearer secret",
                            },
                        },
                    }
                ]
            },
        }

        markdown = format_shared_issue_as_markdown(data)

        # Verify request info
        assert "#### Request Information" in markdown
        assert "**URL:** https://example.com/api/endpoint" in markdown
        assert "**Method:** POST" in markdown
        assert "**Query String:** param1=value1&param2=value2" in markdown

        # Verify headers (only certain headers should be shown)
        assert "user-agent" in markdown.lower()
        assert "content-type" in markdown.lower()
        # Authorization should not be shown (not in useful_headers list)
        assert "authorization" not in markdown.lower()

    def test_stacktrace_truncation(self) -> None:
        """Test that long stack traces are truncated to 10 frames."""
        frames = [
            {"filename": f"file{i}.py", "function": f"func{i}", "lineNo": i} for i in range(20)
        ]

        data = {
            "title": "Long Stack Trace",
            "shortId": "TEST-4",
            "latestEvent": {"entries": [{"type": "stacktrace", "data": {"frames": frames}}]},
        }

        markdown = format_shared_issue_as_markdown(data)

        # Should show only 10 frames
        assert "... (10 more frames)" in markdown

    def test_empty_data(self) -> None:
        """Test that formatter handles empty/minimal data gracefully."""
        data = {"title": "Minimal Issue"}

        markdown = format_shared_issue_as_markdown(data)

        # Should at least have the title
        assert "# Minimal Issue" in markdown

        # Should not crash with missing fields
        assert isinstance(markdown, str)

    def test_unhandled_flag(self) -> None:
        """Test that isUnhandled flag is included in markdown."""
        data = {
            "title": "Unhandled Error",
            "shortId": "TEST-5",
            "isUnhandled": True,
        }

        markdown = format_shared_issue_as_markdown(data)

        assert "**Unhandled:** True" in markdown

    def test_multiple_exceptions(self) -> None:
        """Test formatting of multiple chained exceptions."""
        data = {
            "title": "Chained Exceptions",
            "shortId": "TEST-6",
            "latestEvent": {
                "entries": [
                    {
                        "type": "exception",
                        "data": {
                            "values": [
                                {"type": "KeyError", "value": "'missing_key'"},
                                {"type": "ValueError", "value": "Invalid data"},
                            ]
                        },
                    }
                ]
            },
        }

        markdown = format_shared_issue_as_markdown(data)

        # Should show both exceptions
        assert "**Exception 1:** KeyError" in markdown
        assert "**Exception 2:** ValueError" in markdown
