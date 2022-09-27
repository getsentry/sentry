import dataclasses
import datetime
from typing import Optional, Union

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
            if message_field.name in payload:
                setattr(
                    result,
                    message_field.name,
                    discard_extra_fields(
                        message_field.metadata["constructor"], payload[message_field.name]
                    ),
                )

        return result
