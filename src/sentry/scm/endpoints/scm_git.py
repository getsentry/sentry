import io
from collections.abc import Generator

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBase, StreamingHttpResponse
from rest_framework.request import Request
from scm.errors import GitProviderNotSupported, SCMCodedError
from scm.git.grant import verify_grant
from scm.git.relay import GitRelay
from scm.git.server import GitServer
from scm.git.types import GRANT_HEADER, GitOperation, Readable
from scm.types import Repository
from sentry_sdk import traces

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.negotiation import PassthroughContentNegotiation
from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.services.integration.service import integration_service
from sentry.models.organization import Organization
from sentry.net.http import BlacklistAdapter
from sentry.scm.private.helpers import (
    fetch_repository,
    fetch_service_provider,
    record_count_metric,
)
from sentry.shared_integrations.exceptions import ApiHostError
from sentry.utils.http import request_body_stream

FAILED_METRIC = "sentry.scm.git.request.failed"


def get_git_token(repository: Repository, operation: GitOperation) -> str | None:
    """Return a token that can run git against the repository, minted in control.

    A GitHub installation token carries all of the installation's permissions, so a fetch gets the
    same token as a push.
    """
    provider_name = repository["provider_name"]
    if provider_name in ("github", "github_enterprise"):
        integration = integration_service.refresh_github_access_token(
            integration_id=repository["integration_id"],
            organization_id=repository["organization_id"],
        )
        if integration is None:
            return None
        return integration.metadata.get("access_token")
    raise GitProviderNotSupported(
        detail=f"Sentry can't relay git for {provider_name} repositories yet."
    )


def make_git_server() -> GitServer:
    return GitServer(
        secrets=settings.SCM_GIT_GRANT_SECRETS or [],
        fetch_repository=fetch_repository,
        fetch_provider=fetch_service_provider,
        get_token=get_git_token,
        record_count=record_count_metric,
        # A GitHub Enterprise or self-managed GitLab host is whatever the customer configured, so
        # it may resolve to one of our own addresses.
        relay=GitRelay(adapter=BlacklistAdapter),
    )


@internal_cell_silo_endpoint
class ScmGitEndpoint(Endpoint):
    """
    Serves git's smart-HTTP protocol to coding jobs, relaying each request to the repository's
    provider with the organization's integration credentials. A grant Seer signs authorizes each
    request, so the job never holds a provider credential.
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
        # database. GitServer verifies it again, which costs one HMAC.
        try:
            grant = verify_grant(
                settings.SCM_GIT_GRANT_SECRETS or [], request.headers.get(GRANT_HEADER, "")
            )
        except SCMCodedError as e:
            return _refuse(e.code, 403, e.detail)

        try:
            organization = Organization.objects.get_from_cache(id=grant.organization_id)
        except Organization.DoesNotExist:
            return _refuse(
                "organization_not_found", 404, "The git grant's organization was not found."
            )
        if not features.has("organizations:scm-git-endpoint", organization):
            return _refuse(
                "git_endpoint_disabled",
                404,
                "The git endpoint is not enabled for this organization.",
            )

        try:
            response = make_git_server().handle(
                method=request.method or "",
                repository_id=repository_id,
                route=route,
                query=request.META.get("QUERY_STRING", ""),
                headers=dict(request.headers),
                body=_request_body(request._request),
            )
        except RestrictedIPAddress as e:
            # A 503, like the ApiHostError Sentry's API clients raise for it, and without the
            # address. GitServer has already counted it.
            return _plain_text(ApiHostError.from_exception(e).text, 503)
        return StreamingHttpResponse(
            response.content, status=response.status_code, headers=response.headers
        )


def _request_body(request: HttpRequest) -> Readable | None:
    body = request_body_stream(request)
    if isinstance(body, bytes):
        return io.BytesIO(body)
    if isinstance(body, Generator):
        # Only uwsgi hands over a chunked body as a generator, and Sentry serves with granian.
        raise NotImplementedError("The git endpoint can't stream a chunked body under uwsgi.")
    return body


def _refuse(code: str, status: int, detail: str | None) -> HttpResponse:
    # Counted like the refusals GitServer answers itself.
    record_count_metric(FAILED_METRIC, 1, {"code": code})
    # Never a 401: on a 401 git asks for credentials, which a coding job doesn't have.
    return _plain_text(detail or code, status)


def _plain_text(message: str, status: int) -> HttpResponse:
    # git shows a text/plain body to the user as "remote: <line>".
    return HttpResponse(f"{message}\n", status=status, content_type="text/plain; charset=utf-8")
