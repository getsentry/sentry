from __future__ import annotations

import logging

import orjson
from django.http import HttpRequest
from rest_framework.response import Response

from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.auth.view import AuthView
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse
from sentry.utils.signing import urlsafe_b64decode

from .constants import DOMAIN_BLOCKLIST, ERR_INVALID_DOMAIN, ERR_INVALID_RESPONSE

logger = logging.getLogger("sentry.auth.google")


class FetchUser(AuthView):
    def __init__(self, domains, version, *args, **kwargs) -> None:
        self.domains = domains
        self.version = version
        super().__init__(*args, **kwargs)

    def dispatch(self, request: HttpRequest, pipeline) -> Response:
        data = pipeline.fetch_state("data")

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
            payload = orjson.loads(payload_b)
        except Exception as exc:
            logger.exception("Unable to decode id_token payload: %s", exc)
            return pipeline.error(ERR_INVALID_RESPONSE)

        if not payload.get("email"):
            logger.error("Missing email in id_token payload: %s", id_token)
            return pipeline.error(ERR_INVALID_RESPONSE)

        # support legacy style domains with pure domain regexp
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


def extract_domain(email):
    return email.rsplit("@", 1)[-1]
