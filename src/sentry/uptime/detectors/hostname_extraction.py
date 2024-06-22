from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_ipv46_address
from tldextract import TLDExtract

if TYPE_CHECKING:
    pass

url_validator = URLValidator()

# Configure TLDExtract to not make external calls and just use a local snapshot of tld data
extractor = TLDExtract(
    cache_dir=None,
    suffix_list_urls=(),
    fallback_to_snapshot=True,
)


def extract_hostname_from_url(url: str | None) -> str | None:
    """
    Examines a url string and extracts a usable hostname from it.
    Filters out invalid TLDs and domains with ip addresses. The
    goal is to reduce the set of hostnames down so that we only test
    hostnames that might actually return a valid response.
    """
    if not url:
        return
    try:
        url_validator(url)
    except ValidationError:
        return

    split_url = urlsplit(url)

    # Make sure hostname is not an ip
    try:
        validate_ipv46_address(split_url.netloc)
    except ValidationError:
        pass
    else:
        return

    extracted_url = extractor.extract_urllib(split_url)
    fqdn = extracted_url.fqdn
    return f"{split_url.scheme}://{fqdn}" if fqdn else None
