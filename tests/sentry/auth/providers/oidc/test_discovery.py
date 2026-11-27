from __future__ import annotations

from typing import Any

import pytest
import responses

from sentry.auth.providers.oidc.discovery import (
    DiscoveryError,
    build_provider_config,
    fetch_discovery_document,
)

from . import CLIENT_ID, ISSUER, FakeIdP

idp = FakeIdP()


def build(document: dict[str, Any]) -> dict[str, Any]:
    return build_provider_config(ISSUER, document, client_id=CLIENT_ID, client_secret="enc")


def test_build_provider_config() -> None:
    config = build(idp.discovery_document())

    assert config == {
        "version": "1",
        "issuer": ISSUER,
        "client_id": CLIENT_ID,
        "client_secret": "enc",
        "authorization_endpoint": f"{ISSUER}/authorize",
        "token_endpoint": f"{ISSUER}/token",
        "jwks_uri": f"{ISSUER}/jwks",
        "id_token_signing_alg_values_supported": ["RS256"],
        "token_endpoint_auth_method": "client_secret_basic",
    }


def test_issuer_trailing_slash_is_forgiven_but_discovered_value_is_kept() -> None:
    config = build(idp.discovery_document(issuer=f"{ISSUER}/"))
    assert config["issuer"] == f"{ISSUER}/"


def test_issuer_mismatch() -> None:
    with pytest.raises(DiscoveryError, match="does not match"):
        build(idp.discovery_document(issuer="https://evil.example.com"))


@pytest.mark.parametrize("field", ["authorization_endpoint", "token_endpoint", "jwks_uri"])
def test_endpoints_must_be_https(field: str) -> None:
    with pytest.raises(DiscoveryError, match=field):
        build(idp.discovery_document(**{field: "http://idp.example.com/x"}))
    with pytest.raises(DiscoveryError, match=field):
        build(idp.discovery_document(**{field: None}))


def test_requires_code_flow() -> None:
    with pytest.raises(DiscoveryError, match="authorization code"):
        build(idp.discovery_document(response_types_supported=["id_token"]))


@pytest.mark.parametrize("algs", [["HS256"], ["none"], [], None])
def test_requires_asymmetric_signing(algs: list[str] | None) -> None:
    with pytest.raises(DiscoveryError, match="asymmetric"):
        build(idp.discovery_document(id_token_signing_alg_values_supported=algs))


def test_unsupported_algorithms_are_dropped() -> None:
    config = build(
        idp.discovery_document(id_token_signing_alg_values_supported=["HS256", "ES256", "RS256"])
    )
    assert config["id_token_signing_alg_values_supported"] == ["ES256", "RS256"]


@pytest.mark.parametrize(
    ("methods", "expected"),
    [
        (None, "client_secret_basic"),
        (["client_secret_post"], "client_secret_post"),
        (["client_secret_post", "client_secret_basic"], "client_secret_basic"),
    ],
)
def test_token_endpoint_auth_method(methods: list[str] | None, expected: str) -> None:
    config = build(idp.discovery_document(token_endpoint_auth_methods_supported=methods))
    assert config["token_endpoint_auth_method"] == expected


def test_unsupported_token_endpoint_auth_method() -> None:
    with pytest.raises(DiscoveryError, match="client_secret_basic"):
        build(idp.discovery_document(token_endpoint_auth_methods_supported=["private_key_jwt"]))


@responses.activate
def test_fetch_discovery_document() -> None:
    idp.add_discovery()
    assert fetch_discovery_document(f"{ISSUER}/") == idp.discovery_document()


def test_fetch_discovery_document_requires_https() -> None:
    with pytest.raises(DiscoveryError, match="https"):
        fetch_discovery_document("http://idp.example.com")


@responses.activate
def test_fetch_discovery_document_http_error() -> None:
    responses.add(responses.GET, f"{ISSUER}/.well-known/openid-configuration", status=404)
    with pytest.raises(DiscoveryError, match="HTTP 404"):
        fetch_discovery_document(ISSUER)


@responses.activate
def test_fetch_discovery_document_not_json() -> None:
    responses.add(responses.GET, f"{ISSUER}/.well-known/openid-configuration", body="<html>")
    with pytest.raises(DiscoveryError, match="JSON"):
        fetch_discovery_document(ISSUER)
