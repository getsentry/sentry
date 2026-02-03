from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_ipv46_address
from tldextract import TLDExtract
from tldextract.tldextract import ExtractResult

if TYPE_CHECKING:
    pass

url_validator = URLValidator()

# Configure TLDExtract to not make external calls and just use a local snapshot of tld data.
# Since this is instantiated at import time we don't want to make any external calls as
# this could result in slow startup time or an error that prevents the server from starting.
# We also don't want to be fetching this list from an unknown external source.
extractor = TLDExtract(
    cache_dir=None,
    suffix_list_urls=(),
    fallback_to_snapshot=True,
)


def extract_base_url(url: str | None) -> str | None:
    """
    Examines a url string and returns a url containing just the
    protocol and fully qualified domain name from it.
    Filters out invalid TLDs and domains with ip addresses. The
    goal is to reduce the set of hostnames down so that we only test
    hostnames that might actually return a valid response.
    """
    if not url:
        return None
    try:
        url_validator(url)
    except ValidationError:
        return None

    split_url = urlsplit(url)

    # Make sure hostname is not an ip
    try:
        validate_ipv46_address(split_url.netloc)
    except ValidationError:
        pass
    else:
        return None

    extracted_url = extractor.extract_urllib(split_url)
    fqdn = extracted_url.fqdn
    return f"{split_url.scheme}://{fqdn}" if fqdn else None


def extract_domain_parts(url: str) -> ExtractResult:
    # We enable private PSL domains so that hosting services that use
    # subdomains are treated as suffixes for the purposes of monitoring.
    return extractor.extract_str(url, include_psl_private_domains=True)
