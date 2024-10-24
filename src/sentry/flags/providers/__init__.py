from typing import Any

from sentry.flags.exceptions import InvalidProvider
from sentry.flags.models import (
    ACTION_MAP,
    CREATED_BY_TYPE_MAP,
    FlagAuditLogItem,
    FlagAuditLogModel,
    FlagAuditLogRow,
)
from sentry.flags.providers.launchdarkly import handle_launchdarkly_event
from sentry.flags.providers.unleash import handle_unleash_event
from sentry.silo.base import SiloLimit


def write(rows: list["FlagAuditLogRow"]) -> None:
    try:
        FlagAuditLogModel.objects.bulk_create(FlagAuditLogModel(**row) for row in rows)
    except SiloLimit.AvailabilityError:
        pass


def handle_provider_event(
    provider: str,
    request_data: dict[str, Any],
    organization_id: int,
) -> list[FlagAuditLogRow]:
    """To implement a new provider, define handle_<provider>_event in a new module and add it to
    the match statement here.

    Provider definitions are pure functions. They accept data and return data. Providers do not
    initiate any IO operations. Instead they return commands in the form of the return type or
    an exception. These commands inform the caller (the endpoint defintion) what IO must be
    emitted to satisfy the request. This is done primarily to improve testability and test
    performance but secondarily to allow easy extension of the endpoint without knowledge of
    the underlying systems.
    """
    match provider:
        case "launchdarkly":
            return handle_launchdarkly_event(request_data, organization_id)
        case "unleash":
            return handle_unleash_event(request_data, organization_id)
        case _:
            raise InvalidProvider(provider)


"""Internal flag-pole provider.

Allows us to skip the HTTP endpoint. Does not use the handle_provider_event interface.
"""


def handle_flag_pole_event_internal(items: list[FlagAuditLogItem], organization_id: int) -> None:
    write(
        [
            {
                "action": ACTION_MAP[item["action"]],
                "created_at": item["created_at"],
                "created_by": item["created_by"],
                "created_by_type": CREATED_BY_TYPE_MAP["name"],
                "flag": item["flag"],
                "organization_id": organization_id,
                "tags": item["tags"],
            }
            for item in items
        ]
    )
