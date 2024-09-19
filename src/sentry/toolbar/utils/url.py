from urllib.parse import ParseResult, urlparse

from django.http import HttpRequest

ALLOWED_SCHEMES = ("http", "https")


def url_matches(url: ParseResult, target_url: ParseResult) -> bool:
    """
    Matches a parsed url with a target pattern (also a ParseResult). Checks 3 fields:
    * hostname: must be non-empty and equal target.hostname. The left-most subdomain of `url` may be a wildcard (*).
    * port: optional for `url`. Must equal target.port, unless it is excluded from target.
    * scheme: must be non-empty and equal target.scheme, unless it is excluded from target.
    """

    # We expect hostname exists for both urls.
    hostname, target_hostname = url.hostname, target_url.hostname
    if hostname.startswith("*."):
        hostname = hostname.split(".", 1)[1]
        if "." not in target_hostname:
            return False
        target_hostname = target_hostname.split(".", 1)[1]

    return all(
        [
            hostname == target_hostname,
            not target_url.port or url.port == target_url.port,
            not target_url.scheme or url.scheme == target_url.scheme,
        ]
    )


def check_origin(request: HttpRequest, allowed_origins: list[str]) -> tuple[bool, str]:
    referrer = request.META.get("HTTP_REFERER")
    if referrer:
        parsed_ref = urlparse(referrer)
        if parsed_ref.scheme not in ALLOWED_SCHEMES:
            return False, f"Invalid scheme: {parsed_ref.scheme}"

        for origin in allowed_origins:
            parsed_origin = urlparse(origin)
            if url_matches(parsed_ref, parsed_origin):
                return True, f"Matched allowed origin: {origin}"
        return False, f"Referrer {referrer} does not match allowed origins."

    return False, "Missing referer header"
