from __future__ import annotations

import uuid as uuid_module
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from sentry.seer.models.run import SeerRun

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def resolve_seer_run_state_id(run_id: str, organization: Organization) -> int | None:
    """Translate a client-facing run id (numeric ``seer_run_state_id`` or a
    ``SeerRun.uuid``) into the Seer-side ``seer_run_state_id``.

    A UUID is looked up scoped to ``organization``; returns ``None`` when it
    can't be resolved to a live run. Numeric ids pass straight through.
    """
    try:
        return int(run_id)
    except (TypeError, ValueError):
        pass

    try:
        run_uuid = uuid_module.UUID(str(run_id))
    except (TypeError, ValueError):
        return None

    run = SeerRun.objects.filter(uuid=run_uuid, organization=organization).first()
    if run is None:
        return None
    return run.seer_run_state_id


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
