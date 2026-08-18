from base64 import b64decode
from urllib.parse import parse_qs, urlsplit

import responses
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from django.test import override_settings

from sentry.cache import default_cache
from sentry.managed_ingest_domains.domain_connect import (
    build_cloudflare_domain_connect_url,
    detect_dns_provider,
    get_detected_dns_provider,
)
from sentry.managed_ingest_domains.providers import CloudflareDomainConnectConfig


def test_build_cloudflare_domain_connect_url() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    config: CloudflareDomainConnectConfig = {
        "sync_url": "https://dash.cloudflare.com/domain-connect/",
        "provider_id": "sentry.io",
        "service_id": "managed-ingest",
        "public_key_id": "_dcpubkeyv1",
        "private_key_pem": private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode(),
    }

    url = build_cloudflare_domain_connect_url(
        "errors.app.example.co.uk",
        "ingest.dsntry.com",
        "https://sentry.example/settings/project/",
        config,
    )

    parsed = urlsplit(url)
    assert parsed.path.endswith(
        "/v2/domainTemplates/providers/sentry.io/services/managed-ingest/apply"
    )
    assert "&key=_dcpubkeyv1&sig=" in parsed.query
    assert parsed.query.rsplit("&", 1)[1].startswith("sig=")

    unsigned_query = parsed.query.split("&key=", 1)[0]
    query = parse_qs(parsed.query)
    assert query["domain"] == ["example.co.uk"]
    assert query["host"] == ["errors.app"]
    assert query["target"] == ["ingest.dsntry.com"]
    private_key.public_key().verify(
        b64decode(query["sig"][0]),
        unsigned_query.encode(),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )


@responses.activate
@override_settings(
    SENTRY_MANAGED_INGEST={
        "provider": "fake",
        "cname_target": "ingest.dsntry.com",
        "cloudflare_domain_connect": {
            "sync_url": "https://dash.cloudflare.com/domain-connect",
            "provider_id": "sentry.io",
            "service_id": "managed-ingest",
            "public_key_id": "_dcpubkeyv1",
            "private_key_pem": "unused",
        },
    }
)
def test_detect_cloudflare_dns_provider() -> None:
    cache_key = "managed-ingest:dns-provider:domain-connect-detection.co.uk"
    default_cache.delete(cache_key)
    responses.get(
        "https://api.cloudflare.com/client/v4/dns/domainconnect/v2/"
        "domain-connect-detection.co.uk/settings",
        json={"providerId": "cloudflare.com"},
    )

    hostname = "signals.domain-connect-detection.co.uk"
    assert detect_dns_provider(hostname) == "cloudflare"
    assert get_detected_dns_provider(hostname) == "cloudflare"
    default_cache.delete(cache_key)
