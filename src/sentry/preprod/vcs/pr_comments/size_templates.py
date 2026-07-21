from __future__ import annotations


def format_size_pr_comment(title: str, subtitle: str, summary: str) -> str:
    """Compose the size analysis PR comment body from the status-check pieces.

    Reuses the exact ``(title, subtitle, summary)`` produced by
    ``format_status_check_messages`` so the comment and the status-check summary
    can never render differently.
    """
    return f"## {title}\n\n{subtitle}\n\n{summary}"
