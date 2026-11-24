from __future__ import annotations

import uuid as uuid_module
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Final, Literal, NamedTuple, TypeVar

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import ServiceAccountTokenAuthentication
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import UserRequired
from sentry.seer.autofix.constants import AUTOFIX_RUN_SCOPES, PUBLISH_SCOPES
from sentry.seer.credits import SeerCreditDenialReason
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus
from sentry.utils.numbers import validate_bigint

if TYPE_CHECKING:
    from sentry.auth.access import Access
    from sentry.models.organization import Organization


SEER_PERMISSION_DENIED = "You are not authorized to perform this action"

# Let API clients like the CLI and MCP tell billing 402s apart without parsing detail text.
# The API schema documents these codes as an enum, so a new code has to be added here.
SeerPaymentRequiredCode = Literal["seer_out_of_credits", "seer_out_of_quota"]
SEER_OUT_OF_CREDITS_CODE: Final[SeerPaymentRequiredCode] = "seer_out_of_credits"
SEER_OUT_OF_QUOTA_CODE: Final[SeerPaymentRequiredCode] = "seer_out_of_quota"

SEER_AUTOFIX_START_OUT_OF_CREDITS_DETAIL = (
    "Your organization does not have enough credits to start an Autofix run."
)
SEER_AUTOFIX_CONTINUE_OUT_OF_CREDITS_DETAIL = (
    "Your organization does not have enough credits to continue your Autofix run."
)
SEER_AGENT_CHAT_OUT_OF_CREDITS_DETAIL = (
    "Your organization does not have enough credits left for you to message Seer."
)


def refuse_service_account_token(request: Request) -> None:
    """
    Raise ``UserRequired`` for a request authenticated with a service account token.

    A run started here hands Seer a viewer context that names the service account, not
    the token, so Seer's callbacks would get the account's full scopes. Service-account
    viewer contexts, which Seer itself uses, are still allowed.
    """
    if isinstance(request.successful_authenticator, ServiceAccountTokenAuthentication):
        raise UserRequired()


def seer_out_of_credits_response(
    detail: str, denial_reason: SeerCreditDenialReason | None
) -> Response:
    return Response(
        {"detail": detail, "code": SEER_OUT_OF_CREDITS_CODE, "denialReason": denial_reason},
        status=status.HTTP_402_PAYMENT_REQUIRED,
    )


class OrganizationTraceExplorerAIPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


class ResolvedSeerRun(NamedTuple):
    seer_run_state_id: int
    # None for legacy runs created before SeerRun mirroring, which have no row.
    uuid: str | None


def get_seer_run(seer_run_state_id: int, organization: Organization) -> SeerRun | None:
    """Return the SeerRun mirror row for ``seer_run_state_id`` within this org,
    or None when no row exists (legacy runs predating SeerRun mirroring)."""
    return SeerRun.objects.filter(
        seer_run_state_id=seer_run_state_id, organization=organization
    ).first()  # noqa: S035


_NO_ACCESS_DETAIL = "You do not have access to this run."


def _no_access_response() -> Response:
    return Response(
        {"detail": _NO_ACCESS_DETAIL},
        status=status.HTTP_403_FORBIDDEN,
    )


def _parse_run_id(run_id: str | int) -> int | uuid_module.UUID | Response:
    try:
        seer_run_state_id = int(run_id)
    except (TypeError, ValueError):
        seer_run_state_id = None
    if seer_run_state_id is not None:
        if not validate_bigint(seer_run_state_id):
            return Response({"detail": "Invalid run_id"}, status=status.HTTP_400_BAD_REQUEST)
        return seer_run_state_id
    try:
        return uuid_module.UUID(str(run_id))
    except (TypeError, ValueError):
        return Response({"detail": "Invalid run_id"}, status=status.HTTP_400_BAD_REQUEST)


def _resolve_uuid_run(run: SeerRun, *, for_continue: bool) -> ResolvedSeerRun | Response:
    if run.mirror_status == SeerRunMirrorStatus.FAILED:
        if for_continue:
            return Response(
                {"detail": "This run failed to start and cannot be continued."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response({"session": {"status": "error"}})
    if run.seer_run_state_id is None:
        if for_continue:
            return Response(
                {"detail": "This run is still being created; retry shortly."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response({"session": {"status": "processing"}})
    return ResolvedSeerRun(run.seer_run_state_id, str(run.uuid))


def resolve_seer_run(
    run_id: str | int,
    organization: Organization,
    *,
    for_continue: bool = False,
    user_id: int | None = None,
) -> ResolvedSeerRun | Response:
    """Resolve a client-facing run id (numeric ``seer_run_state_id`` or
    ``SeerRun.uuid``) to a :class:`ResolvedSeerRun`, or an error ``Response``
    (narrow with ``isinstance``). When ``user_id`` is supplied, the mirrored run
    must belong to that user. A numeric id with no ``SeerRun`` row is rejected
    in that case. For a not-ready run, a poll gets the 200
    ``{"session": {"status": ...}}`` shape; ``for_continue`` instead gets 409
    (still mirroring) or 422 (mirror failed).
    """
    parsed = _parse_run_id(run_id)
    if isinstance(parsed, Response):
        return parsed

    if isinstance(parsed, int):
        run = get_seer_run(parsed, organization)
        if user_id is not None and (run is None or run.user_id != user_id):
            return _no_access_response()
        return ResolvedSeerRun(parsed, str(run.uuid) if run else None)

    run = SeerRun.objects.get_or_none(uuid=parsed, organization=organization)
    if run is None:
        return Response({"session": None}, status=status.HTTP_404_NOT_FOUND)
    if user_id is not None and run.user_id != user_id:
        return _no_access_response()
    return _resolve_uuid_run(run, for_continue=for_continue)


def _can_access_run(
    run: SeerRun, access: Access, user_id: int | None, *, write: bool, publish: bool
) -> bool:
    is_owner = user_id is not None and run.user_id == user_id
    try:
        agent: SeerAgentRun | None = run.agent
    except SeerAgentRun.DoesNotExist:
        agent = None

    if agent is not None and agent.group_id is not None:
        group = agent.group
        if group is None:
            return is_owner
        if write:
            scopes = PUBLISH_SCOPES if publish else AUTOFIX_RUN_SCOPES
            return is_owner or access.has_any_project_scope(group.project, scopes)
        return is_owner or access.has_project_access(group.project)
    if write:
        return is_owner
    return run.user_id is None or is_owner


def authorize_seer_run(
    run_id: str | int,
    organization: Organization,
    access: Access,
    user_id: int | None,
    *,
    write: bool,
    publish: bool = False,
) -> ResolvedSeerRun | Response:
    parsed = _parse_run_id(run_id)
    if isinstance(parsed, Response):
        return parsed

    lookup = {"seer_run_state_id": parsed} if isinstance(parsed, int) else {"uuid": parsed}
    run = (
        SeerRun.objects.filter(organization=organization, **lookup)
        .select_related("agent__group__project")
        .first()  # noqa: S035
    )
    if run is None:
        if not isinstance(parsed, int):
            return Response({"session": None}, status=status.HTTP_404_NOT_FOUND)
        return _no_access_response() if write else ResolvedSeerRun(parsed, None)

    if not _can_access_run(run, access, user_id, write=write, publish=publish):
        return _no_access_response()
    if isinstance(parsed, int):
        return ResolvedSeerRun(parsed, str(run.uuid))
    return _resolve_uuid_run(run, for_continue=write)


_RpcReturn = TypeVar("_RpcReturn")


def map_org_id_param(func: Callable[..., _RpcReturn]) -> Callable[..., _RpcReturn]:
    """
    Helper to map organization_id parameter to org_id for backwards compatibility.

    Allows RPC methods to use 'organization_id' while underlying functions use 'org_id'.
    The return type is preserved so the seer RPC registries can keep their
    `Callable[..., BaseModel | None]` mypy guard through this wrapper.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> _RpcReturn:
        kwargs["org_id"] = organization_id
        return func(**kwargs)

    return wrapper


def accept_organization_id_param(func: Callable[..., _RpcReturn]) -> Callable[..., _RpcReturn]:
    """
    Helper to accept organization_id parameter.

    The return type is preserved so the seer RPC registries can keep their
    `Callable[..., BaseModel | None]` mypy guard through this wrapper.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> _RpcReturn:
        return func(**kwargs)

    return wrapper
