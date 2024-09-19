from urllib.parse import ParseResult, urlparse

from django.http import HttpRequest

ALLOWED_SCHEMES = ("http", "https")


def url_matches(url: ParseResult, target_url: ParseResult) -> bool:
    return all(
        [
            url.hostname == target_url.hostname,
            not target_url.scheme or url.scheme == target_url.scheme,
            not target_url.port or url.port == target_url.port,
        ]
    )


def check_request_origin(request: HttpRequest, allowed_origins: list[str]) -> tuple[bool, str]:
    referrer = request.META.get("HTTP_REFERER")
    if referrer:
        parsed_ref = urlparse(referrer)
        if parsed_ref.scheme not in ALLOWED_SCHEMES:
            return False, f"Invalid scheme: {parsed_ref.scheme}"

        for origin in allowed_origins:
            parsed_origin = urlparse(origin)
            if url_matches(parsed_ref, parsed_origin):
                return True, f"Matched allowed origin: {origin}"

    return False, "Missing referer header"
