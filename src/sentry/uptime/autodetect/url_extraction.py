from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_ipv46_address
from tldextract import TLDExtract
from tldextract.suffix_list import extract_tlds_from_suffix_list
from tldextract.tldextract import ExtractResult, _PublicSuffixListTLDExtractor

if TYPE_CHECKING:
    import requests

url_validator = URLValidator()

PUBLIC_SUFFIX_LIST_PATH = Path(__file__).parent / "public_suffix_list.dat"


class _LocalListTLDExtract(TLDExtract):
    """
    Uses our copy of the public suffix list, since tldextract's bundled one is only as new as
    its last release.
    """

    # tldextract can read a file:// suffix list URL itself, but it leaves the file open.
    def _get_tld_extractor(
        self, session: requests.Session | None = None
    ) -> _PublicSuffixListTLDExtractor:
        if self._extractor is None:
            public_tlds, private_tlds = extract_tlds_from_suffix_list(
                PUBLIC_SUFFIX_LIST_PATH.read_text(encoding="utf-8")
            )
            self._extractor = _PublicSuffixListTLDExtractor(
                public_tlds=public_tlds,
                private_tlds=private_tlds,
                extra_tlds=list(self.extra_suffixes),
                include_psl_private_domains=self.include_psl_private_domains,
            )
        return self._extractor


extractor = _LocalListTLDExtract(cache_dir=None, suffix_list_urls=())


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
