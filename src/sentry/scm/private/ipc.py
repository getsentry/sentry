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

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import (
    CheckRunAction,
    CheckRunEvent,
    CommentAction,
    CommentEvent,
    CommentType,
    EventType,
    EventTypeHint,
    HybridCloudSilo,
    ProviderName,
    PullRequestAction,
    PullRequestEvent,
    SubscriptionEvent,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import scm_tasks


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


class AuthorParser(msgspec.Struct, gc=False, frozen=True):
    id: str
    username: str


class CheckRunEventDataParser(msgspec.Struct, gc=False, frozen=True):
    external_id: str
    html_url: str


class CheckRunEventParser(msgspec.Struct, gc=False, frozen=True):
    action: CheckRunAction
    check_run: CheckRunEventDataParser
    subscription_event: SubscriptionEventParser


class CommentEventDataParser(msgspec.Struct, gc=False, frozen=True):
    id: str
    body: str | None
    author: AuthorParser | None


class CommentEventParser(msgspec.Struct, gc=False, frozen=True):
    action: CommentAction
    comment_type: CommentType
    comment: CommentEventDataParser
    subscription_event: SubscriptionEventParser


class PullRequestBranchParser(msgspec.Struct, gc=False, frozen=True):
    sha: str


class PullRequestEventDataParser(msgspec.Struct, gc=False, frozen=True):
    id: str
    title: str
    description: str | None
    head: PullRequestBranchParser
    base: PullRequestBranchParser
    is_private_repo: bool
    author: AuthorParser | None


class PullRequestEventParser(msgspec.Struct, gc=False, frozen=True):
    action: PullRequestAction
    pull_request: PullRequestEventDataParser
    subscription_event: SubscriptionEventParser


check_run_event_decoder = msgspec.msgpack.Decoder(CheckRunEventParser)
comment_event_decoder = msgspec.msgpack.Decoder(CommentEventParser)
pull_request_event_decoder = msgspec.msgpack.Decoder(PullRequestEventParser)
subscription_decoder = msgspec.msgpack.Decoder(SubscriptionEventParser)


def _map_subscription_event(parsed: SubscriptionEventParser) -> SubscriptionEvent:
    return {
        "event": parsed.event,
        "event_type_hint": parsed.event_type_hint,
        "extra": parsed.extra,
        "received_at": parsed.received_at,
        "sentry_meta": (
            [
                {
                    "id": item.id,
                    "integration_id": item.integration_id,
                    "organization_id": item.organization_id,
                }
                for item in parsed.sentry_meta
            ]
            if parsed.sentry_meta
            else None
        ),
        "type": parsed.type,
    }


def deserialize_check_run_event(event_bytes: bytes) -> CheckRunEvent:
    parsed = check_run_event_decoder.decode(event_bytes)
    return CheckRunEvent(
        action=parsed.action,
        check_run={
            "external_id": parsed.check_run.external_id,
            "html_url": parsed.check_run.html_url,
        },
        subscription_event=_map_subscription_event(parsed.subscription_event),
    )


def deserialize_comment_event(event_bytes: bytes) -> CommentEvent:
    parsed = comment_event_decoder.decode(event_bytes)
    return CommentEvent(
        action=parsed.action,
        comment_type=parsed.comment_type,
        comment={
            "id": parsed.comment.id,
            "body": parsed.comment.body,
            "author": (
                {"id": parsed.comment.author.id, "username": parsed.comment.author.username}
                if parsed.comment.author
                else None
            ),
        },
        subscription_event=_map_subscription_event(parsed.subscription_event),
    )


def deserialize_pull_request_event(event_bytes: bytes) -> PullRequestEvent:
    parsed = pull_request_event_decoder.decode(event_bytes)
    return PullRequestEvent(
        action=parsed.action,
        pull_request={
            "id": parsed.pull_request.id,
            "title": parsed.pull_request.title,
            "description": parsed.pull_request.description,
            "head": {"sha": parsed.pull_request.head.sha},
            "base": {"sha": parsed.pull_request.base.sha},
            "is_private_repo": parsed.pull_request.is_private_repo,
            "author": (
                {
                    "id": parsed.pull_request.author.id,
                    "username": parsed.pull_request.author.username,
                }
                if parsed.pull_request.author
                else None
            ),
        },
        subscription_event=_map_subscription_event(parsed.subscription_event),
    )


def deserialize_subscription_event(
    event: bytes, report_exception: Callable[[Exception], None]
) -> SubscriptionEvent | None:
    try:
        result = subscription_decoder.decode(event)
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


encoder = msgspec.msgpack.Encoder()


def serialize_check_run_event(event: CheckRunEvent) -> bytes:
    check_run_data = CheckRunEventDataParser(
        external_id=event.check_run["external_id"],
        html_url=event.check_run["html_url"],
    )
    subscription_event = SubscriptionEventParser(
        event=event.subscription_event["event"],
        event_type_hint=event.subscription_event["event_type_hint"],
        extra=event.subscription_event["extra"],
        received_at=event.subscription_event["received_at"],
        sentry_meta=(
            [
                SubscriptionEventSentryMetaParser(
                    id=item["id"],
                    integration_id=item["integration_id"],
                    organization_id=item["organization_id"],
                )
                for item in event.subscription_event["sentry_meta"]
            ]
            if event.subscription_event["sentry_meta"]
            else None
        ),
        type=event.subscription_event["type"],
    )
    structured_event = CheckRunEventParser(
        action=event.action,
        check_run=check_run_data,
        subscription_event=subscription_event,
    )
    return encoder.encode(structured_event)


def serialize_comment_event(event: CommentEvent) -> bytes:
    comment_data = CommentEventDataParser(
        id=event.comment["id"],
        body=event.comment["body"],
        author=(
            AuthorParser(
                id=event.comment["author"]["id"], username=event.comment["author"]["username"]
            )
            if event.comment["author"]
            else None
        ),
    )
    subscription_event = SubscriptionEventParser(
        event=event.subscription_event["event"],
        event_type_hint=event.subscription_event["event_type_hint"],
        extra=event.subscription_event["extra"],
        received_at=event.subscription_event["received_at"],
        sentry_meta=(
            [
                SubscriptionEventSentryMetaParser(
                    id=item["id"],
                    integration_id=item["integration_id"],
                    organization_id=item["organization_id"],
                )
                for item in event.subscription_event["sentry_meta"]
            ]
            if event.subscription_event["sentry_meta"]
            else None
        ),
        type=event.subscription_event["type"],
    )
    structured_event = CommentEventParser(
        action=event.action,
        comment_type=event.comment_type,
        comment=comment_data,
        subscription_event=subscription_event,
    )
    return encoder.encode(structured_event)


def serialize_pull_request_event(event: PullRequestEvent) -> bytes:
    pull_request_data = PullRequestEventDataParser(
        id=event.pull_request["id"],
        title=event.pull_request["title"],
        description=event.pull_request["description"],
        head=PullRequestBranchParser(sha=event.pull_request["head"]["sha"]),
        base=PullRequestBranchParser(sha=event.pull_request["base"]["sha"]),
        is_private_repo=event.pull_request["is_private_repo"],
        author=(
            AuthorParser(
                id=event.pull_request["author"]["id"],
                username=event.pull_request["author"]["username"],
            )
            if event.pull_request["author"]
            else None
        ),
    )
    subscription_event = SubscriptionEventParser(
        event=event.subscription_event["event"],
        event_type_hint=event.subscription_event["event_type_hint"],
        extra=event.subscription_event["extra"],
        received_at=event.subscription_event["received_at"],
        sentry_meta=(
            [
                SubscriptionEventSentryMetaParser(
                    id=item["id"],
                    integration_id=item["integration_id"],
                    organization_id=item["organization_id"],
                )
                for item in event.subscription_event["sentry_meta"]
            ]
            if event.subscription_event["sentry_meta"]
            else None
        ),
        type=event.subscription_event["type"],
    )
    structured_event = PullRequestEventParser(
        action=event.action,
        pull_request=pull_request_data,
        subscription_event=subscription_event,
    )
    return encoder.encode(structured_event)


def serialize_subscription_event(event: SubscriptionEvent) -> bytes:
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


def deserialize_event(event: bytes, event_type: EventTypeHint) -> EventType:
    if event_type == "check_run":
        return deserialize_check_run_event(event)
    elif event_type == "comment":
        return deserialize_comment_event(event)
    elif event_type == "pull_request":
        return deserialize_pull_request_event(event)
    else:
        return deserialize_subscription_event(event)


def serialize_event(event: EventType, event_type: EventTypeHint) -> bytes:
    if event_type == "check_run":
        return serialize_check_run_event(event)
    elif event_type == "comment":
        return serialize_comment_event(event)
    elif event_type == "pull_request":
        return serialize_pull_request_event(event)
    else:
        return serialize_subscription_event(event)


# $$$$$$$\            $$\       $$\ $$\           $$\
# $$  __$$\           $$ |      $$ |\__|          $$ |
# $$ |  $$ |$$\   $$\ $$$$$$$\  $$ |$$\  $$$$$$$\ $$$$$$$\   $$$$$$\   $$$$$$\
# $$$$$$$  |$$ |  $$ |$$  __$$\ $$ |$$ |$$  _____|$$  __$$\ $$  __$$\ $$  __$$\
# $$  ____/ $$ |  $$ |$$ |  $$ |$$ |$$ |\$$$$$$\  $$ |  $$ |$$$$$$$$ |$$ |  \__|
# $$ |      $$ |  $$ |$$ |  $$ |$$ |$$ | \____$$\ $$ |  $$ |$$   ____|$$ |
# $$ |      \$$$$$$  |$$$$$$$  |$$ |$$ |$$$$$$$  |$$ |  $$ |\$$$$$$$\ $$ |
# \__|       \______/ \_______/ \__|\__|\_______/ \__|  \__| \_______|\__|


def produce_to_listener(
    message: bytes,
    event_type_hint: EventTypeHint,
    listener_name: str,
    silo: HybridCloudSilo,
) -> None:
    if silo == "control":
        run_webhook_handler_control_task.delay(listener_name, message, event_type_hint)
    else:
        run_webhook_handler_region_task.delay(listener_name, message, event_type_hint)


@instrumented_task(
    silo_mode=SiloMode.CONTROL,
    name="sentry.scm.run_webhook_handler_control_task",
    namespace=scm_tasks,
    processing_deadline_duration=10,
)
def run_webhook_handler_control_task(
    listener_name: str, message: bytes, event_type_hint: EventTypeHint
) -> None:
    listener = scm_event_stream.listeners[event_type_hint][listener_name]
    run_webhook_handler(
        listener,
        message,
        event_type_hint,
        report_exception=report_exception,
    )


@instrumented_task(
    silo_mode=SiloMode.REGION,
    name="sentry.scm.run_webhook_handler_region_task",
    namespace=scm_tasks,
    processing_deadline_duration=10,
)
def run_webhook_handler_region_task(
    listener_name: str, message: bytes, event_type_hint: EventTypeHint
) -> None:
    listener = scm_event_stream.listeners[event_type_hint][listener_name]
    run_webhook_handler(
        listener,
        message,
        event_type_hint,
        report_exception=report_exception,
    )


def run_webhook_handler(
    listener: str,
    message: bytes,
    event_type_hint: EventTypeHint,
    *,
    report_exception: Callable[[Exception], None],
    record_metric: Callable[[str, int, dict[str, str]], None],
    get_current_time: Callable[[], float] = time.time,
):
    event = deserialize_subscription_event(event_bytes, report_exception=report_exception)
    if event:
        handler = get_handler(handler_name)
        handler(event)


def report_exception(e: Exception) -> None:
    sentry_sdk.capture_exception(e)
