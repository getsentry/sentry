import re
from urllib.parse import ParseResult, urlparse

# Lets break down the regexp:
# 0. Anchor the start of the string with `^`
# 1. The Scheme section: `((?P<scheme>https?)?://)?`
# - optionally we'll capture `http://` or `https://` or `://`
# - if we have `http` or `https` then we'll put them in the group named "scheme"
# 2. The hostname section: `(?P<hostname>[^:/?]+)`
# - capture all characters but stop at the first of `:` or `/` or `?`
# - put the string in a group named "hostname"
# 3. The post section: `(:(?P<port>[^/?]+))?`
# - optionally we'll capture all the characters starting with `:` and ending before `/` or `?`
# - put the part after `:` in a group named `port`
# 4. Match anything else: `.*$`
# - This is everything after `/` or `?` which we might've found in step #2 or #3
# - If there is a match or not, we don't name it. It will be ignored.
#
# Test and view it with tools like these:
# https://regex101.com/r/rWQyb9/1
# https://regex-vis.com/?r=%5E%28%28https%3F%29%3F%3A%2F%2F%29%3F%28%5B%5E%3A%2F%3F%5D%2B%29%28%3A%28%5B%5E%2F%3F%5D%2B%29%29%3F.*%24
pattern = re.compile("^((?P<scheme>https?)?://)?(?P<hostname>[^:/?]+)(:(?P<port>[^/?]+))?.*$", re.I)


def url_matches(source: ParseResult, target: str) -> bool:
    """
    Matches a referrer url with a user-provided one. Checks 3 fields:
    * hostname: must equal target.hostname. The first subdomain in target may be a wildcard "*".
    * port: must equal target.port, unless it is excluded from target.
    * scheme: must equal target.scheme, unless it is excluded from target.
    Note both url's path is ignored.
    """

    match = re.match(pattern, target)
    if not match:
        return False

    scheme = match.group("scheme")
    hostname = match.group("hostname")
    port = match.group("port")

    if not source.hostname or not hostname:
        return False

    is_wildcard_scheme = scheme == "://" or scheme is None
    if not is_wildcard_scheme and source.scheme != scheme:
        return False

    is_wildcard_subdomain = hostname.startswith("*.") or hostname.startswith(".")
    if is_wildcard_subdomain:
        source_root = source.hostname.split(".", 1)[1]
        target_root = hostname.split(".", 1)[1]
        if source_root != target_root:
            return False
    elif source.hostname != hostname:
        return False

    is_default_port = port is None
    source_port = _get_port(source)
    if not is_default_port and source_port != port:
        return False

    return True


def _get_port(parsed: ParseResult) -> str:
    if parsed.port:
        return str(parsed.port)
    elif parsed.scheme == "http":
        return "80"
    elif parsed.scheme == "https":
        return "443"
    return ""


def is_origin_allowed(referrer: str, allowed_origins: list[str]) -> bool:
    # Empty referrer is always invalid
    if not referrer:
        return False

    # The input referrer must be a well-formed url with a valid scheme.
    if not referrer.startswith("http://") and not referrer.startswith("https://"):
        return False

    parsed_referrer = urlparse(referrer)
    for origin in allowed_origins:
        if url_matches(parsed_referrer, origin):
            return True
    return False
