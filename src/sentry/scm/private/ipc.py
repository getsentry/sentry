"""
This file implements a parallel SubscriptionEvent type. Its in the msgspec format rather than a
typed dictionary. We maintain a mapping between the two types. Msgspec gives us typed
deserialization and the typed dictionary gives us an import free calling convention when
serializing.

Both types are owned by the SCM platform and should not diverge without the team's knowledge.
Exposing the msgspec type is not preferred. It is an internal implementation detail. It is both an
optimization and a convenient, typed deserialization library.
"""

import time
from collections.abc import Callable

import msgspec
import sentry_sdk

from sentry.scm.types import ProviderName, SubscriptionEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import scm_tasks


# GC is disabled. You MUST NEVER use this in such a way that a reference cycle is created.
# Fortunately this is a private struct not intended for use anywhere but here. So as long as we
# know what to do we can give great performace to our consumers transparently.
#
# Frozen is set to ensure immuatability. Attributes may not be changed after being set.
class SubscriptionEventParser(msgspec.Struct, gc=False, frozen=True):
    event_type_hint: str | None
    event: bytes
    extra: dict[str, str | None | bool | int | float]
    received_at: int
    sentry_meta: list["SubscriptionEventSentryMetaParser"] | None
    type: ProviderName


class SubscriptionEventSentryMetaParser(msgspec.Struct, gc=False, frozen=True):
    id: int | None
    integration_id: int
    organization_id: int


# $$$$$$$\                                          $$\           $$\ $$\
# $$  __$$\                                         \__|          $$ |\__|
# $$ |  $$ | $$$$$$\   $$$$$$$\  $$$$$$\   $$$$$$\  $$\  $$$$$$\  $$ |$$\ $$$$$$$$\  $$$$$$\   $$$$$$\
# $$ |  $$ |$$  __$$\ $$  _____|$$  __$$\ $$  __$$\ $$ | \____$$\ $$ |$$ |\____$$  |$$  __$$\ $$  __$$\
# $$ |  $$ |$$$$$$$$ |\$$$$$$\  $$$$$$$$ |$$ |  \__|$$ | $$$$$$$ |$$ |$$ |  $$$$ _/ $$$$$$$$ |$$ |  \__|
# $$ |  $$ |$$   ____| \____$$\ $$   ____|$$ |      $$ |$$  __$$ |$$ |$$ | $$  _/   $$   ____|$$ |
# $$$$$$$  |\$$$$$$$\ $$$$$$$  |\$$$$$$$\ $$ |      $$ |\$$$$$$$ |$$ |$$ |$$$$$$$$\ \$$$$$$$\ $$ |
# \_______/  \_______|\_______/  \_______|\__|      \__| \_______|\__|\__|\________| \_______|\__|


# A decoder global is defined. This is a performance optimization. Because this decoder will be
# repeatedly called within a Kafka consumer (which should have a reasonably tight loop) this
# optimization will improve deserialization performance for most consumer types (especially types
# with rare events).
decoder = msgspec.msgpack.Decoder(SubscriptionEventParser)


def deserialize_event(
    event: bytes, report_exception: Callable[[Exception], None]
) -> SubscriptionEvent | None:
    try:
        result = decoder.decode(event)
        return {
            "event": result.event,
            "event_type_hint": result.event_type_hint,
            "extra": result.extra,
            "received_at": result.received_at,
            "sentry_meta": (
                [
                    {
                        "id": item.id,
                        "integration_id": item.integration_id,
                        "organization_id": item.organization_id,
                    }
                    for item in result.sentry_meta
                ]
                if result.sentry_meta
                else None
            ),
            "type": result.type,
        }
    except msgspec.DecodeError as e:
        report_exception(e)
        return None


#  $$$$$$\                      $$\           $$\ $$\
# $$  __$$\                     \__|          $$ |\__|
# $$ /  \__| $$$$$$\   $$$$$$\  $$\  $$$$$$\  $$ |$$\ $$$$$$$$\  $$$$$$\   $$$$$$\
# \$$$$$$\  $$  __$$\ $$  __$$\ $$ | \____$$\ $$ |$$ |\____$$  |$$  __$$\ $$  __$$\
#  \____$$\ $$$$$$$$ |$$ |  \__|$$ | $$$$$$$ |$$ |$$ |  $$$$ _/ $$$$$$$$ |$$ |  \__|
# $$\   $$ |$$   ____|$$ |      $$ |$$  __$$ |$$ |$$ | $$  _/   $$   ____|$$ |
# \$$$$$$  |\$$$$$$$\ $$ |      $$ |\$$$$$$$ |$$ |$$ |$$$$$$$$\ \$$$$$$$\ $$ |
#  \______/  \_______|\__|      \__| \_______|\__|\__|\________| \_______|\__|


encoder = msgspec.msgpack.Encoder()


def serialize_event(event: SubscriptionEvent) -> bytes:
    structured_event = SubscriptionEventParser(
        event=event["event"],
        event_type_hint=event["event_type_hint"],
        extra=event["extra"],
        received_at=event["received_at"],
        sentry_meta=(
            [
                SubscriptionEventSentryMetaParser(
                    id=item["id"],
                    integration_id=item["integration_id"],
                    organization_id=item["organization_id"],
                )
                for item in event["sentry_meta"]
            ]
            if event["sentry_meta"]
            else None
        ),
        type=event["type"],
    )

    return encoder.encode(structured_event)


# $$$$$$$\            $$\       $$\ $$\           $$\
# $$  __$$\           $$ |      $$ |\__|          $$ |
# $$ |  $$ |$$\   $$\ $$$$$$$\  $$ |$$\  $$$$$$$\ $$$$$$$\   $$$$$$\   $$$$$$\
# $$$$$$$  |$$ |  $$ |$$  __$$\ $$ |$$ |$$  _____|$$  __$$\ $$  __$$\ $$  __$$\
# $$  ____/ $$ |  $$ |$$ |  $$ |$$ |$$ |\$$$$$$\  $$ |  $$ |$$$$$$$$ |$$ |  \__|
# $$ |      $$ |  $$ |$$ |  $$ |$$ |$$ | \____$$\ $$ |  $$ |$$   ____|$$ |
# $$ |      \$$$$$$  |$$$$$$$  |$$ |$$ |$$$$$$$  |$$ |  $$ |\$$$$$$$\ $$ |
# \__|       \______/ \_______/ \__|\__|\_______/ \__|  \__| \_______|\__|


@instrumented_task(
    silo_mode=SiloMode.CONTROL,
    name="sentry.scm.run_webhook_handler_control_task",
    namespace=scm_tasks,
    processing_deadline_duration=10,
)
def run_webhook_handler_control_task(handler_name: str, event_bytes: bytes) -> None:
    run_webhook_handler(
        handler_name,
        event_bytes,
        get_handler=lambda s: lambda e: None,
        report_exception=report_exception,
    )


@instrumented_task(
    silo_mode=SiloMode.REGION,
    name="sentry.scm.run_webhook_handler_region_task",
    namespace=scm_tasks,
    processing_deadline_duration=10,
)
def run_webhook_handler_region_task(handler_name: str, event_bytes: bytes) -> None:
    run_webhook_handler(
        handler_name,
        event_bytes,
        get_handler=lambda s: lambda e: None,
        report_exception=report_exception,
    )


def run_webhook_handler(
    handler_name: str,
    event_bytes: bytes,
    *,
    get_handler: Callable[[str], Callable[[SubscriptionEvent], None]],
    report_exception: Callable[[Exception], None],
    record_metric: Callable[[str, int, dict[str, str]], None],
    get_current_time: Callable[[], float] = time.time,
):
    event = deserialize_event(event_bytes, report_exception=report_exception)
    if event:
        handler = get_handler(handler_name)
        handler(event)


def report_exception(e: Exception) -> None:
    sentry_sdk.capture_exception(e)
