from __future__ import annotations

from base64 import b64encode
from typing import Literal, TypedDict, cast
from urllib.parse import quote, urlencode

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from django.conf import settings
from tldextract import TLDExtract

from sentry.cache import default_cache
from sentry.managed_ingest_domains.providers import (
    CloudflareDomainConnectConfig,
    ManagedIngestProviderConfig,
)
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.shared_integrations.exceptions import ApiError

_extract_domain = TLDExtract(cache_dir=None, suffix_list_urls=(), fallback_to_snapshot=True)
_DNS_PROVIDER_CACHE_TTL = 600
_UNSUPPORTED_DNS_PROVIDER = "unsupported"

type DetectedDnsProvider = Literal["cloudflare"]


class _CloudflareDomainConnectSettings(TypedDict):
    providerId: str


class _CloudflareDomainConnectClient(BaseApiClient):
    base_url = "https://api.cloudflare.com/client/v4/dns/domainconnect"
    integration_type = "managed_ingest"
    managed_ingest_name = "cloudflare_domain_connect"
    metrics_prefix = "managed_ingest.cloudflare_domain_connect"
    allow_redirects = False


def _root_domain(hostname: str) -> str:
    extracted = _extract_domain(hostname, include_psl_private_domains=True)
    return f"{extracted.domain}.{extracted.suffix}"


def _dns_provider_cache_key(hostname: str) -> str:
    return f"managed-ingest:dns-provider:{_root_domain(hostname)}"


def get_cloudflare_domain_connect_config() -> CloudflareDomainConnectConfig | None:
    config = cast(ManagedIngestProviderConfig | None, settings.SENTRY_MANAGED_INGEST)
    if config is None:
        return None
    return config.get("cloudflare_domain_connect")


def get_detected_dns_provider(hostname: str) -> DetectedDnsProvider | None:
    provider = default_cache.get(_dns_provider_cache_key(hostname))
    return "cloudflare" if provider == "cloudflare" else None


def detect_dns_provider(hostname: str) -> DetectedDnsProvider | None:
    if get_cloudflare_domain_connect_config() is None:
        return None

    cache_key = _dns_provider_cache_key(hostname)
    cached_provider = default_cache.get(cache_key)
    if cached_provider is not None:
        return "cloudflare" if cached_provider == "cloudflare" else None

    domain = _root_domain(hostname)
    try:
        domain_connect_settings = cast(
            _CloudflareDomainConnectSettings,
            _CloudflareDomainConnectClient().get(f"/v2/{quote(domain, safe='')}/settings"),
        )
    except ApiError as error:
        if error.code == 404:
            default_cache.set(cache_key, _UNSUPPORTED_DNS_PROVIDER, _DNS_PROVIDER_CACHE_TTL)
        return None

    provider: DetectedDnsProvider | None = (
        "cloudflare" if domain_connect_settings["providerId"] == "cloudflare.com" else None
    )
    default_cache.set(cache_key, provider or _UNSUPPORTED_DNS_PROVIDER, _DNS_PROVIDER_CACHE_TTL)
    return provider


def build_cloudflare_domain_connect_url(
    hostname: str,
    cname_target: str,
    redirect_uri: str,
    config: CloudflareDomainConnectConfig,
) -> str:
    extracted = _extract_domain(hostname, include_psl_private_domains=True)
    domain = _root_domain(hostname)

    query = urlencode(
        {
            "domain": domain,
            "host": extracted.subdomain,
            "redirect_uri": redirect_uri,
            "target": cname_target,
        }
    )
    private_key = cast(
        rsa.RSAPrivateKey,
        serialization.load_pem_private_key(config["private_key_pem"].encode(), password=None),
    )
    signature = b64encode(
        private_key.sign(query.encode(), padding.PKCS1v15(), hashes.SHA256())
    ).decode()

    sync_url = config["sync_url"].rstrip("/")
    provider_id = quote(config["provider_id"], safe="")
    service_id = quote(config["service_id"], safe="")
    key = quote(config["public_key_id"], safe="")
    encoded_signature = quote(signature, safe="")
    return (
        f"{sync_url}/v2/domainTemplates/providers/{provider_id}/services/{service_id}/apply"
        f"?{query}&key={key}&sig={encoded_signature}"
    )
