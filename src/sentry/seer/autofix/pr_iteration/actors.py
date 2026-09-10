from __future__ import annotations


def is_bot_login(login: str) -> bool:
    """Whether a GitHub login belongs to an app identity, for example ``dependabot[bot]``."""
    return login.lower().endswith("[bot]")
