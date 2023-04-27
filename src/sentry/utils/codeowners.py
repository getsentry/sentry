import sentry_relay

# Max accepted string length of the CODEOWNERS file
MAX_RAW_LENGTH: int = 3_000_000


def codeowners_match(value, pat):
    """A beefed up version of fnmatch.fnmatch"""
    return sentry_relay.is_codeowners_path_match(
        value if value is not None else "",
        pat,
    )
