import datetime
from typing import Any, TypedDict

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.silo.base import SiloLimit


def write(rows: list["FlagAuditLogRow"]) -> None:
    try:
        FlagAuditLogModel.objects.bulk_create(FlagAuditLogModel(**row) for row in rows)
    except SiloLimit.AvailabilityError:
        pass


"""Provider definitions.

Provider definitions are pure functions. They accept data and return data. Providers do not
initiate any IO operations. Instead they return commands in the form of the return type or
an exception. These commands inform the caller (the endpoint defintion) what IO must be
emitted to satisfy the request. This is done primarily to improve testability and test
performance but secondarily to allow easy extension of the endpoint without knowledge of
the underlying systems.
"""


class FlagAuditLogRow(TypedDict):
    """A complete flag audit log row instance."""

    action: int
    created_at: datetime.datetime
    created_by: str
    created_by_type: int
    flag: str
    organization_id: int
    tags: dict[str, Any]


class DeserializationError(Exception):
    """The request body could not be deserialized."""

    def __init__(self, errors):
        self.errors = errors


class InvalidProvider(Exception):
    """An unsupported provider type was specified."""

    ...


def handle_provider_event(
    provider: str,
    request_data: dict[str, Any],
    organization_id: int,
) -> list[FlagAuditLogRow]:
    raise InvalidProvider(provider)


"""Internal flag-pole provider.

Allows us to skip the HTTP endpoint.
"""


class FlagAuditLogItem(TypedDict):
    """A simplified type which is easier to work with than the row definition."""

    action: str
    flag: str
    created_at: datetime.datetime
    created_by: str
    tags: dict[str, str]


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
