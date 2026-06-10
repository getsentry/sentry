from __future__ import annotations

import uuid as uuid_module
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, NamedTuple

from rest_framework import status
from rest_framework.response import Response

from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class ResolvedSeerRun(NamedTuple):
    seer_run_state_id: int
    # None for legacy runs created before SeerRun mirroring, which have no row.
    uuid: str | None


def resolve_seer_run(run_id: str | int, organization: Organization) -> ResolvedSeerRun | Response:
    """Resolve a client-facing run id (numeric ``seer_run_state_id`` or a
    ``SeerRun.uuid``) to its :class:`SeerRun`, scoped to ``organization``.

    Returns a :class:`ResolvedSeerRun` (the Seer-side id and the run's UUID) in
    a single lookup, or an error ``Response`` following the ``{"session": ...}``
    poll contract: 400 for an unparseable id, 404 for an unknown run, and a
    ``processing`` / ``error`` session status while the run's Seer id isn't
    mirrored yet or its mirror failed. Callers narrow with
    ``isinstance(result, Response)``.

    A numeric id with no mirror row falls back to a bare passthrough (UUID
    ``None``) so runs predating mirroring still resolve.
    """
    try:
        seer_run_state_id = int(run_id)
    except (TypeError, ValueError):
        seer_run_state_id = None

    if seer_run_state_id is not None:
        run = SeerRun.objects.filter(
            seer_run_state_id=seer_run_state_id, organization=organization
        ).first()
        return ResolvedSeerRun(seer_run_state_id, str(run.uuid) if run else None)

    try:
        run_uuid = uuid_module.UUID(str(run_id))
    except (TypeError, ValueError):
        return Response({"detail": "Invalid run_id"}, status=status.HTTP_400_BAD_REQUEST)

    run = SeerRun.objects.filter(uuid=run_uuid, organization=organization).first()
    if run is None:
        return Response({"session": None}, status=status.HTTP_404_NOT_FOUND)
    if run.mirror_status == SeerRunMirrorStatus.FAILED:
        return Response({"session": {"status": "error"}})
    if run.seer_run_state_id is None:
        return Response({"session": {"status": "processing"}})
    return ResolvedSeerRun(run.seer_run_state_id, str(run.uuid))


def map_org_id_param(func: Callable) -> Callable:
    """
    Helper to map organization_id parameter to org_id for backwards compatibility.

    Allows RPC methods to use 'organization_id' while underlying functions use 'org_id'.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> Any:
        kwargs["org_id"] = organization_id
        return func(**kwargs)

    return wrapper


def accept_organization_id_param(func: Callable) -> Callable:
    """
    Helper to accept organization_id parameter.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> Any:
        return func(**kwargs)

    return wrapper
