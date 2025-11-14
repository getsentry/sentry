from __future__ import annotations

import logging
from typing import int, Any

import orjson
from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.auth.helper import AuthHelper
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.auth.view import AuthView
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse
from sentry.utils.signing import urlsafe_b64decode

from .constants import DOMAIN_BLOCKLIST, ERR_INVALID_DOMAIN, ERR_INVALID_RESPONSE

logger = logging.getLogger("sentry.auth.google")


class FetchUser(AuthView):
    def __init__(
        self, domains: list[str] | None, version: str | None, *args: Any, **kwargs: Any
    ) -> None:
        self.domains = domains
        self.version = version
        super().__init__(*args, **kwargs)

    def dispatch(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        data: dict[str, Any] | None = pipeline.fetch_state("data")
        assert data is not None

        try:
            id_token = data["id_token"]
        except KeyError:
            logger.exception("Missing id_token in OAuth response: %s", data)
            return pipeline.error(ERR_INVALID_RESPONSE)

        try:
            _, payload_b, _ = map(urlsafe_b64decode, id_token.split(".", 2))
        except Exception as exc:
            logger.exception("Unable to decode id_token: %s", exc)
            return pipeline.error(ERR_INVALID_RESPONSE)

        try:
            payload: dict[str, Any] = orjson.loads(payload_b)
        except Exception as exc:
            logger.exception("Unable to decode id_token payload: %s", exc)
            return pipeline.error(ERR_INVALID_RESPONSE)

        if not payload.get("email"):
            logger.error("Missing email in id_token payload: %s", id_token)
            return pipeline.error(ERR_INVALID_RESPONSE)

        # support legacy style domains with pure domain regexp
        domain: str | None = None
        if self.version is None:
            domain = extract_domain(payload["email"])
        else:
            domain = payload.get("hd")

        if domain is None:
            return pipeline.error(ERR_INVALID_DOMAIN % (domain,))

        if domain in DOMAIN_BLOCKLIST:
            return pipeline.error(ERR_INVALID_DOMAIN % (domain,))

        if self.domains and domain not in self.domains:
            return pipeline.error(ERR_INVALID_DOMAIN % (domain,))

        pipeline.bind_state("domain", domain)
        pipeline.bind_state("user", payload)

        return pipeline.next_step()


def google_configure_view(
    request: HttpRequest, organization: RpcOrganization, auth_provider: RpcAuthProvider
) -> DeferredResponse:
    config = auth_provider.config
    if config.get("domain"):
        domains: list[str] | None
        domains = [config["domain"]]
    else:
        domains = config.get("domains")
    return DeferredResponse("sentry_auth_google/configure.html", {"domains": domains or []})


def extract_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1]
