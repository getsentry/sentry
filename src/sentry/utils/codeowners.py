import sentry_relay


def codeowners_match(value, pat):
    """A beefed up version of fnmatch.fnmatch"""
    return sentry_relay.is_codeowners_path_match(
        value if value is not None else "",
        pat,
    )
