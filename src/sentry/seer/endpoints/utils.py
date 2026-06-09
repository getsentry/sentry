from __future__ import annotations

import enum
import uuid as uuid_module
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class SeerRunResolutionStatus(enum.Enum):
    RESOLVED = "resolved"
    INVALID = "invalid"
    NOT_FOUND = "not_found"
    PENDING = "pending"
    FAILED = "failed"


@dataclass(frozen=True)
class SeerRunResolution:
    status: SeerRunResolutionStatus
    seer_run_state_id: int | None = None


def resolve_seer_run(run_id: str | int, organization: Organization) -> SeerRunResolution:
    """Resolve a client-facing run id (numeric ``seer_run_state_id`` or a
    ``SeerRun.uuid``) to the Seer-side ``seer_run_state_id``.

    Numeric ids pass straight through (legacy/internal). A UUID is looked up
    scoped to ``organization``; the result distinguishes an unparseable id, a
    missing run, a run whose Seer id isn't mirrored yet, and a failed mirror so
    callers can map each to their own response.
    """
    try:
        return SeerRunResolution(SeerRunResolutionStatus.RESOLVED, int(run_id))
    except (TypeError, ValueError):
        pass

    try:
        run_uuid = uuid_module.UUID(str(run_id))
    except (TypeError, ValueError):
        return SeerRunResolution(SeerRunResolutionStatus.INVALID)

    run = SeerRun.objects.filter(uuid=run_uuid, organization=organization).first()
    if run is None:
        return SeerRunResolution(SeerRunResolutionStatus.NOT_FOUND)
    if run.mirror_status == SeerRunMirrorStatus.FAILED:
        return SeerRunResolution(SeerRunResolutionStatus.FAILED)
    if run.seer_run_state_id is None:
        return SeerRunResolution(SeerRunResolutionStatus.PENDING)
    return SeerRunResolution(SeerRunResolutionStatus.RESOLVED, run.seer_run_state_id)


def resolve_seer_run_state_id(run_id: str | int, organization: Organization) -> int | None:
    """Resolve to the Seer-side ``seer_run_state_id``, or ``None`` when the run
    id can't be resolved to a live run. Thin wrapper over :func:`resolve_seer_run`
    for callers that don't need to distinguish why resolution failed.
    """
    return resolve_seer_run(run_id, organization).seer_run_state_id


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
