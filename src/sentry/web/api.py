from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.urls import reverse
from django.views.decorators.cache import cache_control
from django.views.generic.base import View as BaseView
from rest_framework.request import Request

from sentry.conf.types.sentry_config import SentryMode
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import all_silo_view, control_silo_view

# Paths to pages should not be added here, otherwise crawlers will
# not be able to access the metadata with the 'none' directive
# and the URL of these pages may still appear in search results
ROBOTS_SENTRY_IO = """\
User-agent: *
Disallow: /api/
Allow: /

Sitemap: https://sentry.io/sitemap-index.xml
"""

# For customer domains, like acme.us.sentry.io,
# we want to disallow honest crawlers from accessing any page on a customer domain.
# This should prevent a customer domain from showing up in search engine results.
ROBOTS_DISALLOW_ALL = """\
User-agent: *
Disallow: /
"""

SECURITY = """-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

# Sentry runs a private bug bounty program using HackerOne.
# We are not currently providing invitations for new users.
# Please submit your report to our mailbox and we will triage it.
# If your report is valid we may then invite you to our program.
Contact: security@sentry.io
Policy: https://sentry.io/security/#vulnerability-disclosure
Encryption: https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x641d2f6c230dbe3b
# Please refer to https://sentry.io/cookiebounty/ for details on Cookie Bounty
-----BEGIN PGP SIGNATURE-----

iQIzBAEBCAAdFiEE5AbCeulxZRWhse2GZB0vbCMNvjsFAmfPA7EACgkQZB0vbCMN
vjt10hAAt7DYhdgnm03+VtrBfGD5ZGzdyVslkjhGSLmW0G8wy7krU/V6R3GcTy7V
89DHrSBbf74KeA4XgzJdQvFtY+pxnWa/MGTP42YOyO0oVhU/gL4cTuqjgr70+XbA
eoCWmqObLpbnInIEifw4/6fOHV9UJwbQ8l5RAn3jQiVy2SLPx4l2jdHef01SO/Xe
T/S6ISTgB0nnxLVL/YfgIv/zt1n3nKiauaHYgv/wAbZX+9oSOtmGhWQnzVBb9dV+
8nBaw2wgAOibpva62doSdEBioSa4BW/NwTV/Ie1/nYVUZfqsj3Kuz2Uk150woqca
GkqleGeXOK2ge5Gij0UEytSrHjJjAJP1VsSJrDSPyFMv+/kywc7xFCYFLfNuGCQJ
cc8Vibz+2++LEjjWegdfBoOLOJ6LjlMjRkHTdhvT3ktq1fMrVzeK6ISabomhvA1U
oA2Qhm5f0NulzgFq0Rv3Fm/Btqcmfq0C0U5WMYhl7A93wRS1Jne5vLCELdKr6oFi
9KhGUh/0wgxa5ym06OUDeUnafbW0DrGCevTvlA9aL0sylGi5VRzflkh/A/ZqqWxl
qqhu0ruhXhdAnV0UJXDQ/kTkyQm0gfevrZe13Fk3zYvRXGPwaIt3qnCkUPhFEOuq
O0niYEXndk4N2xsvaENku+59+201icBV2XKCtfCcPXWI1oRQrPc=
=+eVN
-----END PGP SIGNATURE-----
"""

MCP_CONFIG = {
    "name": "Sentry",
    "description": "Connect to Sentry, debug faster.",
    "endpoint": "https://mcp.sentry.dev/mcp",
}


@all_silo_view
class ClientConfigView(BaseView):
    def get(self, request: Request) -> HttpResponse:
        return HttpResponse(json.dumps(get_client_config(request)), content_type="application/json")


@all_silo_view
@cache_control(max_age=3600, public=True)
def robots_txt(request):
    if settings.SENTRY_MODE == SentryMode.SAAS and not request.subdomain:
        return HttpResponse(ROBOTS_SENTRY_IO, content_type="text/plain")

    return HttpResponse(ROBOTS_DISALLOW_ALL, content_type="text/plain")


@all_silo_view
@cache_control(max_age=3600, public=True)
def security_txt(request):
    if settings.SENTRY_MODE == SentryMode.SELF_HOSTED:
        return HttpResponse(status=404)

    return HttpResponse(SECURITY, content_type="text/plain")


@all_silo_view
@cache_control(max_age=3600, public=True)
def mcp_json(request):
    if settings.SENTRY_MODE == SentryMode.SELF_HOSTED:
        return HttpResponse(status=404)

    return HttpResponse(json.dumps(MCP_CONFIG), content_type="application/json")


@control_silo_view
@cache_control(max_age=3600, public=True)
def oauth_authorization_server_metadata(request: HttpRequest) -> HttpResponse:
    """OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).

    Purpose
    - Publishes Sentry's authorization server metadata so OAuth clients can
      discover the issuer, endpoint URLs, supported grant types, PKCE methods,
      client authentication methods, and available scopes without hardcoding
      configuration.

    Request
    - `GET /.well-known/oauth-authorization-server`
    - No authentication is required (RFC 8414 §3).

    Response
    - Success: 200 JSON metadata document including:
      `issuer`, `authorization_endpoint`, `token_endpoint`,
      `userinfo_endpoint`, `device_authorization_endpoint`,
      `response_types_supported`, `grant_types_supported`,
      `code_challenge_methods_supported`,
      `token_endpoint_auth_methods_supported`, and `scopes_supported`.
    - Cache headers: `Cache-Control: max-age=3600, public`.

    Notes
    - `issuer` is published as Sentry's canonical base URL.
    - `response_types_supported` is limited to `code`.
    - `code_challenge_methods_supported` is limited to `S256`.
    """
    # Build sorted scopes list for consistent output
    scopes = sorted(settings.SENTRY_SCOPES)

    metadata = {
        "issuer": absolute_uri(),
        "authorization_endpoint": absolute_uri(reverse("sentry-oauth-authorize")),
        "token_endpoint": absolute_uri(reverse("sentry-oauth-token")),
        "userinfo_endpoint": absolute_uri(reverse("sentry-api-0-oauth-userinfo")),
        "device_authorization_endpoint": absolute_uri(reverse("sentry-oauth-device-code")),
        "response_types_supported": ["code"],
        "grant_types_supported": [
            "authorization_code",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:device_code",
        ],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
            "none",
        ],
        "scopes_supported": scopes,
    }

    return HttpResponse(json.dumps(metadata), content_type="application/json")


@all_silo_view
@cache_control(max_age=3600, public=True)
def not_found(request):
    return HttpResponse(status=404)
