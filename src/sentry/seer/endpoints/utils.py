from __future__ import annotations

import uuid as uuid_module
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from rest_framework import status
from rest_framework.response import Response

from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def resolve_seer_run_state_id(
    run_id: str | int, organization: Organization
) -> tuple[int | None, Response | None]:
    """Resolve a client-facing run id (numeric ``seer_run_state_id`` or a
    ``SeerRun.uuid``) to the Seer-side ``seer_run_state_id``.

    Returns ``(seer_run_state_id, None)`` when resolved. Otherwise returns
    ``(None, error_response)`` following the ``{"session": ...}`` poll contract:
    400 for an unparseable id, 404 for an unknown run, and a ``processing`` /
    ``error`` session status while the run's Seer id isn't mirrored yet or its
    mirror failed. Numeric ids pass straight through.
    """
    try:
        return int(run_id), None
    except (TypeError, ValueError):
        pass

    try:
        run_uuid = uuid_module.UUID(str(run_id))
    except (TypeError, ValueError):
        return None, Response({"detail": "Invalid run_id"}, status=status.HTTP_400_BAD_REQUEST)

    run = SeerRun.objects.filter(uuid=run_uuid, organization=organization).first()
    if run is None:
        return None, Response({"session": None}, status=status.HTTP_404_NOT_FOUND)
    if run.mirror_status == SeerRunMirrorStatus.FAILED:
        return None, Response({"session": {"status": "error"}})
    if run.seer_run_state_id is None:
        return None, Response({"session": {"status": "processing"}})
    return run.seer_run_state_id, None


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
