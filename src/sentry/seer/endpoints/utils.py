from __future__ import annotations

import uuid as uuid_module
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, NamedTuple, TypeVar

from rest_framework import status
from rest_framework.response import Response

from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus
from sentry.utils.numbers import validate_bigint

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class ResolvedSeerRun(NamedTuple):
    seer_run_state_id: int
    # None for legacy runs created before SeerRun mirroring, which have no row.
    uuid: str | None


def get_seer_run(seer_run_state_id: int, organization: Organization) -> SeerRun | None:
    """Return the SeerRun mirror row for ``seer_run_state_id`` within this org,
    or None when no row exists (legacy runs predating SeerRun mirroring)."""
    return SeerRun.objects.filter(
        seer_run_state_id=seer_run_state_id, organization=organization
    ).first()


def resolve_seer_run(
    run_id: str | int,
    organization: Organization,
    *,
    for_continue: bool = False,
) -> ResolvedSeerRun | Response:
    """Resolve a client-facing run id (numeric ``seer_run_state_id`` or
    ``SeerRun.uuid``) to a :class:`ResolvedSeerRun`, or an error ``Response``
    (narrow with ``isinstance``). For a not-ready run, a poll gets the 200
    ``{"session": {"status": ...}}`` shape; ``for_continue`` instead gets 409
    (still mirroring) or 422 (mirror failed).
    """
    try:
        seer_run_state_id = int(run_id)
    except (TypeError, ValueError):
        seer_run_state_id = None

    if seer_run_state_id is not None:
        if not validate_bigint(seer_run_state_id):
            return Response({"detail": "Invalid run_id"}, status=status.HTTP_400_BAD_REQUEST)
        run = get_seer_run(seer_run_state_id, organization)
        return ResolvedSeerRun(seer_run_state_id, str(run.uuid) if run else None)

    try:
        run_uuid = uuid_module.UUID(str(run_id))
    except (TypeError, ValueError):
        return Response({"detail": "Invalid run_id"}, status=status.HTTP_400_BAD_REQUEST)

    run = SeerRun.objects.filter(uuid=run_uuid, organization=organization).first()
    if run is None:
        return Response({"session": None}, status=status.HTTP_404_NOT_FOUND)
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
