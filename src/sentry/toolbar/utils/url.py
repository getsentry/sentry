from urllib.parse import ParseResult, urlparse


def url_matches(referrer: ParseResult, target_url: str) -> bool:
    """
    Matches a referrer url with a user-provided one. Checks 3 fields:
    * hostname: must equal target.hostname. The first subdomain in target may be a wildcard "*".
    * port: must equal target.port, unless it is excluded from target.
    * scheme: must equal target.scheme, unless it is excluded from target.
    Note both url's path is ignored.

    @param referrer_url: Must have a valid scheme and hostname.
    @param target_url: Must have a valid hostname, may exclude scheme. The first subdomain may be a wildcard "*".
    """
    target = urlparse(target_url)
    if not target.scheme:  # urlparse doesn't work well if scheme is missing
        target = urlparse(referrer.scheme + "://" + target_url)

    ref_hostname, target_hostname = referrer.hostname, target.hostname
    if not ref_hostname or not target_hostname:
        return False

    if target_hostname.startswith("*."):
        ref_hostname = ref_hostname.split(".", 1)[1]
        target_hostname = target_hostname.split(".", 1)[1]

    return all(
        [
            ref_hostname == target_hostname,
            not target.port or referrer.port == target.port,
            referrer.scheme == target.scheme,
        ]
    )


def is_origin_allowed(referrer: str, allowed_origins: list[str]) -> bool:
    if not urlparse(referrer).scheme:
        referrer = "http://" + referrer

    parsed_referrer = urlparse(referrer)
    for origin in allowed_origins:
        if url_matches(parsed_referrer, origin):
            return True
    return False
