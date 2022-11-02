import dataclasses
import datetime
from typing import Mapping, Optional, Union

from sentry.utils import json


@dataclasses.dataclass
class UserIpEvent:
    user_id: int
    ip_address: str
    last_seen: datetime.datetime
    country_code: Optional[str] = None
    region_code: Optional[str] = None


@dataclasses.dataclass
class NormalizedUserIpEvent(UserIpEvent):
    user_id: int = -1
    ip_address: str = "127.0.0.1"
    last_seen: datetime.datetime = datetime.datetime(2000, 1, 1)


@dataclasses.dataclass
class AuditLogEvent:
    organization_id: int
    # 'datetime' is apparently reserved attribute name for dataclasses.
    time_of_creation: datetime.datetime
    event_id: int
    actor_label: str
    actor_user_id: Optional[int] = None
    ip_address: Optional[str] = None
    target_object_id: Optional[int] = None
    data: Optional[Mapping[str, any]] = None
    # Note: actor_key is NOT serialized into this model on purpose.
    # That model is control silo constrained -- audit log entries
    # created with that attribute should not float across any regions
    # as a serialized event payload.


@dataclasses.dataclass
class NormalizedAuditLogEvent(AuditLogEvent):
    organization_id: int = -1
    time_of_creation: datetime.datetime = datetime.datetime(2000, 1, 1)
    event_id: int = -1
    actor_label: str = ""


def discard_extra_fields(Dc, payload):
    message_field: dataclasses.Field
    kwds = {}
    for message_field in dataclasses.fields(Dc):
        if message_field.name in payload:
            kwds[message_field.name] = payload[message_field.name]

    return Dc(**kwds)


@dataclasses.dataclass
class RegionToControlMessage:
    user_ip_event: Optional[UserIpEvent] = dataclasses.field(
        default=None, metadata=dict(constructor=NormalizedUserIpEvent)
    )

    audit_log_event: Optional[AuditLogEvent] = dataclasses.field(
        default=None, metadata=dict(constructor=NormalizedAuditLogEvent)
    )

    @staticmethod
    def from_payload(payload: Union[str, bytes, dict]):
        # Perform any upgrading that may be necessary for migrations since the region silo could in theory send messages
        # with schemas older than the current.  test_region_to_control_consumer has historical payload
        # regression tests which you should add to as well.
        if not isinstance(payload, dict):
            payload = json.loads(payload)

        message_field: dataclasses.Field
        result = RegionToControlMessage()
        for message_field in dataclasses.fields(RegionToControlMessage):
            if message_field.name in payload and payload[message_field.name] is not None:
                setattr(
                    result,
                    message_field.name,
                    discard_extra_fields(
                        message_field.metadata["constructor"], payload[message_field.name]
                    ),
                )

        return result
