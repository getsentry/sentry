import io
import logging
from collections.abc import Generator

import sentry_sdk
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBase, StreamingHttpResponse
from rest_framework.request import Request
from scm.errors import GitGrantKeyError, GitRemoteRefused, SCMCodedError
from scm.git.grant import verify_grant
from scm.git.relay import GitRelay
from scm.git.server import GitServer
from scm.git.types import GRANT_HEADER, Readable
from sentry_sdk import traces

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.negotiation import PassthroughContentNegotiation
from sentry.exceptions import RestrictedIPAddress
from sentry.models.organization import Organization
from sentry.net.http import BlacklistAdapter
from sentry.scm.private.helpers import fetch_access_token, make_fetchers, record_count_metric
from sentry.utils.http import request_body_stream

logger = logging.getLogger(__name__)

FAILED_METRIC = "sentry.scm.git.request.failed"


def report_git_error(error: Exception, context: dict[str, str]) -> None:
    # An SCMCodedError's detail never holds a URL or a credential. Any other exception is named
    # rather than quoted, since its message could hold either.
    if isinstance(error, SCMCodedError):
        _report_failure(error.code, error.detail, context)
    else:
        _report_failure(type(error).__name__, type(error).__name__, context)


def make_git_server() -> GitServer:
    fetchers = make_fetchers()
    return GitServer(
        public_keys=_grant_public_keys(),
        fetch_repository=fetchers.fetch_repository,
        fetch_provider=fetchers.fetch_provider,
        get_token=fetch_access_token,
        record_count=record_count_metric,
        emit_error=report_git_error,
        # A GitHub Enterprise or self-managed GitLab host is whatever the customer configured, so
        # it may resolve to one of our own addresses.
        relay=GitRelay(adapter=BlacklistAdapter, map_error=_map_relay_error),
    )


def _map_relay_error(error: Exception) -> SCMCodedError | None:
    # BlacklistAdapter refuses an internal address with Sentry's own exception, which scm-platform
    # doesn't know. Mapped, GitServer counts, reports and answers it like its other refusals, and
    # the report leaves out the address and the urllib3 frames that hold the token.
    if isinstance(error, RestrictedIPAddress):
        return GitRemoteRefused()
    return None


@internal_cell_silo_endpoint
class ScmGitEndpoint(Endpoint):
    """
    Serves git's smart-HTTP protocol to coding jobs, relaying each request to the repository's
    provider with the organization's integration credentials. A grant Seer signs authorizes each
    request, so the job never holds a provider credential.

    Only the credential proxy Seer's jobs go through can reach this route, so every refusal is
    reported as a Sentry issue: a refusal means Sentry or Seer is misconfigured, not that a
    client misbehaved.
    """

    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.CODING_WORKFLOWS
    authentication_classes = ()
    permission_classes = ()
    # git's bodies are packs and git asks for its own media types, so nothing is parsed or
    # negotiated.
    parser_classes = ()
    content_negotiation_class = PassthroughContentNegotiation
    enforce_rate_limit = False

    @traces.trace
    def get(self, request: Request, repository_id: str, route: str) -> HttpResponseBase:
        return self._relay(request, int(repository_id), route)

    @traces.trace
    def post(self, request: Request, repository_id: str, route: str) -> HttpResponseBase:
        return self._relay(request, int(repository_id), route)

    def _relay(self, request: Request, repository_id: int, route: str) -> HttpResponseBase:
        # The grant names the organization whose flag gates the endpoint, and it's verified before
        # the organization is looked up, so a request without a valid grant never reaches the
        # database. GitServer verifies the JWT again, which costs one Ed25519 signature check.
        context = {"repository_id": str(repository_id)}
        try:
            grant = verify_grant(_grant_public_keys(), request.headers.get(GRANT_HEADER, ""))
        except GitGrantKeyError as e:
            # No grant could verify against the key list. That's Sentry's misconfiguration, not the
            # grant's fault, so it's a 500 rather than a 403. Seer fails a checkout on a 500 at
            # once, where it retries a 502 or 503, which no retry would fix. The message names a
            # key by its place in the list, never its contents.
            return _refuse(
                "grant_public_keys_invalid",
                500,
                f"SCM_GIT_GRANT_PUBLIC_KEYS is misconfigured: {e}",
                context,
                tags={},
            )
        except SCMCodedError as e:
            return _refuse(e.code, 403, e.detail, context, tags={})

        context |= {"organization_id": str(grant.organization_id), "referrer": grant.referrer}
        tags = {"referrer": grant.referrer}
        try:
            organization = Organization.objects.get_from_cache(id=grant.organization_id)
        except Organization.DoesNotExist:
            return _refuse(
                "organization_not_found",
                404,
                "The git grant's organization was not found.",
                context,
                tags,
            )
        if not features.has("organizations:scm-git-endpoint", organization):
            return _refuse(
                "git_endpoint_disabled",
                404,
                "The git endpoint is not enabled for this organization.",
                context,
                tags,
            )

        response = make_git_server().handle(
            method=request.method or "",
            repository_id=repository_id,
            route=route,
            query=request.META.get("QUERY_STRING", ""),
            headers=dict(request.headers),
            body=_request_body(request._request),
        )
        return StreamingHttpResponse(
            response.content, status=response.status_code, headers=response.headers
        )


def _grant_public_keys() -> list[str]:
    return settings.SCM_GIT_GRANT_PUBLIC_KEYS


def _request_body(request: HttpRequest) -> Readable | None:
    # Endpoint.dispatch has already read a body sent with a Content-Length into memory, and nginx
    # sends every body that way in production, so a push is held whole up to nginx's size cap.
    # Only a chunked body, as on the devserver, is still read as it streams.
    body = request_body_stream(request)
    if isinstance(body, bytes):
        return io.BytesIO(body)
    if isinstance(body, Generator):
        # Only uwsgi hands over a chunked body as a generator, and Sentry serves with granian.
        raise NotImplementedError("The git endpoint can't stream a chunked body under uwsgi.")
    return body


def _refuse(
    code: str, status: int, detail: str, context: dict[str, str], tags: dict[str, str]
) -> HttpResponse:
    # Counted and reported like the refusals GitServer answers itself.
    record_count_metric(FAILED_METRIC, 1, {"code": code} | tags)
    _report_failure(code, detail, context)
    # Never a 401: on a 401 git asks for credentials, which a coding job doesn't have.
    return _plain_text(detail, status)


def _report_failure(code: str, detail: str, context: dict[str, str]) -> None:
    # git shows the client only the message, which leaves out the repository, organization and
    # provider, so the log and the issue's tags carry them. The detail can vary within a code, so
    # the fingerprint groups by code alone.
    logger.error("scm.git.request_failed", extra={"code": code, "detail": detail, **context})
    with sentry_sdk.new_scope() as scope:
        scope.fingerprint = ["scm-git", code]
        scope.set_tags(context)
        # A message, never the exception: Sentry's SDK sends every frame's local variables
        # unscrubbed, and the frames a refusal is raised from hold the provider token, and
        # requests' hold its Authorization header.
        sentry_sdk.capture_message(detail, level="error")


def _plain_text(message: str, status: int) -> HttpResponse:
    # git shows a text/plain body to the user as "remote: <line>".
    return HttpResponse(f"{message}\n", status=status, content_type="text/plain; charset=utf-8")
