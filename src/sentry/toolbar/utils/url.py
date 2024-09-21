from urllib.parse import urlparse

from django.http import HttpRequest

ALLOWED_SCHEMES = ("http", "https")
REFERRER_HEADER = "HTTP_REFERER"  # 1 R is the spelling used here: https://docs.djangoproject.com/en/5.1/ref/request-response/


def url_matches(referrer_url: str, target_url: str) -> bool:
    """
    Matches a referrer url with a user-provided one. Checks 3 fields:
    * hostname: must equal target.hostname. The first subdomain in target may be a wildcard "*".
    * port: must equal target.port, unless it is excluded from target.
    * scheme: must equal target.scheme, unless it is excluded from target.
    Note both url's path is ignored.

    @param referrer_url: Must have a valid scheme and hostname.
    @param target_url: May exclude scheme. THe first subdomain may be a wildcard "*".
    """
    referrer = urlparse(referrer_url)  # Always has scheme and hostname
    target = urlparse(target_url)
    if not target.scheme:  # urlparse doesn't work well if scheme is missing
        target = urlparse(referrer.scheme + "://" + target_url)

    ref_hostname, target_hostname = referrer.hostname, target.hostname
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


def validate_scheme_and_origin(
    request: HttpRequest, allowed_origins: list[str]
) -> tuple[bool, str]:
    referrer: str | None = request.META.get(REFERRER_HEADER)
    if referrer:
        parsed_ref = urlparse(referrer)
        if parsed_ref.scheme not in ALLOWED_SCHEMES:
            return False, f"Invalid scheme: {parsed_ref.scheme}"
        if not parsed_ref.hostname:
            return False, f"Missing hostname in {referrer}"

        for origin in allowed_origins:
            if url_matches(referrer, origin):
                return True, f"Matched allowed origin: {origin}"
        return False, f"Referrer {referrer} does not match allowed origins."

    return False, f"Could not validate origin, missing {REFERRER_HEADER} header."
