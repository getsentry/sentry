from sentry_relay.processing import is_glob_match


def glob_match(
    value: str | bytes | None,
    pat: str | bytes,
    doublestar: bool = False,
    ignorecase: bool = False,
    path_normalize: bool = False,
    allow_newline: bool = True,
) -> bool:
    """A beefed up version of fnmatch.fnmatch"""
    return is_glob_match(
        value if value is not None else "",
        pat,
        double_star=doublestar,
        case_insensitive=ignorecase,
        path_normalize=path_normalize,
        allow_newline=allow_newline,
    )


def glob_star_match(pattern: str, value: str) -> bool:
    """
    Match value against a star-only glob pattern (case-insensitive).

    '*' matches zero or more of any character. Every other character,
    including '?' and '[', is treated as a literal for now.
    """
    pattern = pattern.lower()
    value = value.lower()
    # Split on '*' to get the literal segments that must appear in order.
    # e.g. "a*b*c" -> ["a", "b", "c"]
    parts = pattern.split("*")
    # No wildcard — require exact equality.
    if len(parts) == 1:
        return value == pattern
    # parts[0] is the prefix anchor; value must start with it.
    if not value.startswith(parts[0]):
        return False
    # parts[-1] is the suffix anchor; value must end with it (unless the
    # pattern ends with '*', in which case parts[-1] is "" and any suffix matches).
    if not value.endswith(parts[-1]) and parts[-1] != "":
        return False
    # Narrow the search window to exclude the already-matched prefix and suffix.
    end = len(value) - len(parts[-1]) if parts[-1] else len(value)
    start = len(parts[0])
    # The prefix and suffix anchors overlap, meaning the
    # value is shorter than prefix + suffix combined — no valid match possible.
    if start > end:
        return False
    # Walk the middle segments left-to-right, advancing the cursor after each hit
    # so that relative ordering is preserved.
    for part in parts[1:-1]:
        if not part:
            # Consecutive '*'s produce empty segments — nothing to match, skip.
            continue
        idx = value.find(part, start, end)
        if idx == -1:
            return False
        start = idx + len(part)
    return True
