"""Shared issue/event formatter: converts issue/event data into text (markdown/xml) for LLMs.

One implementation used by every surface (REST API, RPC, direct import) so formatting
stays consistent and a new issue type renders without per-consumer changes.
"""

from sentry.issues.formatting.profiles import format_issue

__all__ = ["format_issue"]
