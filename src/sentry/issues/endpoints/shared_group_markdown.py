"""
Markdown formatter for shared issues.

This module provides utilities to render shared issues in markdown format
for AI agents and other consumers that prefer markdown over JSON.
"""

from __future__ import annotations

from typing import Any


def format_shared_issue_as_markdown(data: dict[str, Any]) -> str:
    """
    Format a shared issue data dictionary as markdown.

    Args:
        data: Serialized shared issue data from SharedGroupSerializer

    Returns:
        Markdown formatted string representation of the issue
    """
    lines = []

    # Title and basic info
    title = data.get("title", "Untitled Issue")
    short_id = data.get("shortId", "")
    lines.append(f"# {title}")
    if short_id:
        lines.append(f"\n**Issue ID:** {short_id}")

    permalink = data.get("permalink")
    if permalink:
        lines.append(f"**Link:** {permalink}")

    # Issue metadata
    lines.append("\n## Issue Details")

    issue_category = data.get("issueCategory", "")
    if issue_category:
        lines.append(f"- **Category:** {issue_category}")

    is_unhandled = data.get("isUnhandled")
    if is_unhandled is not None:
        lines.append(f"- **Unhandled:** {is_unhandled}")

    culprit = data.get("culprit")
    if culprit:
        lines.append(f"- **Culprit:** `{culprit}`")

    # Project information
    project = data.get("project", {})
    if project:
        lines.append("\n## Project")
        project_name = project.get("name", "")
        project_slug = project.get("slug", "")
        if project_name:
            lines.append(f"- **Name:** {project_name}")
        if project_slug:
            lines.append(f"- **Slug:** {project_slug}")

        org = project.get("organization", {})
        if org:
            org_name = org.get("name", "")
            org_slug = org.get("slug", "")
            if org_name:
                lines.append(f"- **Organization:** {org_name}")
            if org_slug:
                lines.append(f"  - **Slug:** {org_slug}")

    # Latest event information
    latest_event = data.get("latestEvent", {})
    if latest_event:
        lines.append("\n## Latest Event")

        event_id = latest_event.get("eventID") or latest_event.get("id")
        if event_id:
            lines.append(f"- **Event ID:** `{event_id}`")

        platform = latest_event.get("platform")
        if platform:
            lines.append(f"- **Platform:** {platform}")

        date_created = latest_event.get("dateCreated")
        if date_created:
            lines.append(f"- **Date:** {date_created}")

        message = latest_event.get("message")
        if message:
            lines.append(f"\n**Message:**\n```\n{message}\n```")

        # Event entries (stack traces, exception, etc.)
        entries = latest_event.get("entries", [])
        if entries:
            lines.append("\n### Event Details")
            for entry in entries:
                entry_type = entry.get("type", "")
                entry_data = entry.get("data", {})

                if entry_type == "exception":
                    _format_exception_entry(entry_data, lines)
                elif entry_type == "message":
                    _format_message_entry(entry_data, lines)
                elif entry_type == "stacktrace":
                    _format_stacktrace_entry(entry_data, lines)
                elif entry_type == "request":
                    _format_request_entry(entry_data, lines)

    return "\n".join(lines)


def _format_exception_entry(data: dict[str, Any], lines: list[str]) -> None:
    """Format an exception entry."""
    values = data.get("values", [])
    if not values:
        return

    lines.append("\n#### Exception")
    for idx, exc in enumerate(values):
        exc_type = exc.get("type", "Unknown")
        exc_value = exc.get("value", "")
        mechanism = exc.get("mechanism", {})

        if len(values) > 1:
            lines.append(f"\n**Exception {idx + 1}:** {exc_type}")
        else:
            lines.append(f"\n**Type:** {exc_type}")

        if exc_value:
            lines.append(f"**Value:** {exc_value}")

        if mechanism:
            mechanism_type = mechanism.get("type")
            if mechanism_type:
                lines.append(f"**Mechanism:** {mechanism_type}")

        # Stack trace for this exception
        stacktrace = exc.get("stacktrace")
        if stacktrace:
            _format_stacktrace_data(stacktrace, lines)


def _format_stacktrace_entry(data: dict[str, Any], lines: list[str]) -> None:
    """Format a stacktrace entry."""
    lines.append("\n#### Stack Trace")
    _format_stacktrace_data(data, lines)


def _format_stacktrace_data(stacktrace: dict[str, Any], lines: list[str]) -> None:
    """Format stacktrace data."""
    frames = stacktrace.get("frames", [])
    if not frames:
        return

    lines.append("\n```")
    # Show frames in reverse order (most recent first)
    for frame in reversed(frames[-10:]):  # Only show last 10 frames to keep it concise
        filename = frame.get("filename") or frame.get("absPath", "unknown")
        function = frame.get("function", "unknown")
        lineno = frame.get("lineNo")
        context_line = frame.get("context")

        location = f"{filename}:{lineno}" if lineno else filename
        lines.append(f"  at {function} ({location})")

        # Show context line if available
        if context_line:
            lines.append(f"    > {context_line.strip()}")

    if len(frames) > 10:
        lines.append(f"  ... ({len(frames) - 10} more frames)")

    lines.append("```")


def _format_message_entry(data: dict[str, Any], lines: list[str]) -> None:
    """Format a message entry."""
    formatted = data.get("formatted")
    if formatted:
        lines.append(f"\n**Message:**\n```\n{formatted}\n```")


def _format_request_entry(data: dict[str, Any], lines: list[str]) -> None:
    """Format a request entry."""
    lines.append("\n#### Request Information")

    url = data.get("url")
    if url:
        lines.append(f"- **URL:** {url}")

    method = data.get("method")
    if method:
        lines.append(f"- **Method:** {method}")

    query_string = data.get("queryString")
    if query_string:
        if isinstance(query_string, str):
            lines.append(f"- **Query String:** {query_string}")
        elif isinstance(query_string, list):
            qs_str = "&".join([f"{k}={v}" for k, v in query_string])
            if qs_str:
                lines.append(f"- **Query String:** {qs_str}")

    headers = data.get("headers")
    if headers and isinstance(headers, dict):
        # Only show some common useful headers
        useful_headers = ["user-agent", "referer", "content-type"]
        filtered_headers = {k: v for k, v in headers.items() if k.lower() in useful_headers}
        if filtered_headers:
            lines.append("\n**Headers:**")
            for key, value in filtered_headers.items():
                lines.append(f"- `{key}`: {value}")
