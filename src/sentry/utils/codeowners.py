from sentry_relay.processing import is_codeowners_path_match

# Max accepted string length of the CODEOWNERS file
MAX_RAW_LENGTH = 3_000_000


def codeowners_match(value, pat):
    """A beefed up version of fnmatch.fnmatch"""
    return is_codeowners_path_match(
        value if value is not None else "",
        pat,
    )
