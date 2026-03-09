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
from typing import assert_never, cast

import msgspec
import sentry_sdk

from sentry.scm.errors import SCMProviderNotSupported
from sentry.scm.private.event_stream import SourceCodeManagerEventStream, scm_event_stream
from sentry.scm.private.webhooks.github import deserialize_github_event
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
from sentry.utils import metrics


class SubscriptionEventParser(msgspec.Struct, gc=False, frozen=True):
    event_type_hint: str | None
    event: str
    extra: dict[str, str | None | bool | int | float]
    received_at: int
    sentry_meta: list["SubscriptionEventSentryMetaParser"] | None
    type: ProviderName


class SubscriptionEventSentryMetaParser(msgspec.Struct, gc=False, frozen=True):
    id: int | None
    integration_id: int | None
    organization_id: int | None


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
    ref: str
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


check_run_event_decoder = msgspec.json.Decoder(CheckRunEventParser)
comment_event_decoder = msgspec.json.Decoder(CommentEventParser)
pull_request_event_decoder = msgspec.json.Decoder(PullRequestEventParser)


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


def _map_subscription_event_parser(event: SubscriptionEvent) -> SubscriptionEventParser:
    return SubscriptionEventParser(
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


def deserialize_check_run_event(event_data: str) -> CheckRunEvent:
    parsed = check_run_event_decoder.decode(event_data)
    return CheckRunEvent(
        action=parsed.action,
        check_run={
            "external_id": parsed.check_run.external_id,
            "html_url": parsed.check_run.html_url,
        },
        subscription_event=_map_subscription_event(parsed.subscription_event),
    )


def deserialize_comment_event(event_data: str) -> CommentEvent:
    parsed = comment_event_decoder.decode(event_data)
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


def deserialize_pull_request_event(event_data: str) -> PullRequestEvent:
    parsed = pull_request_event_decoder.decode(event_data)
    return PullRequestEvent(
        action=parsed.action,
        pull_request={
            "id": parsed.pull_request.id,
            "title": parsed.pull_request.title,
            "description": parsed.pull_request.description,
            "head": {"ref": parsed.pull_request.head.ref, "sha": parsed.pull_request.head.sha},
            "base": {"ref": parsed.pull_request.base.ref, "sha": parsed.pull_request.base.sha},
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


encoder = msgspec.json.Encoder()


def serialize_check_run_event(event: CheckRunEvent) -> str:
    check_run_data = CheckRunEventDataParser(
        external_id=event.check_run["external_id"],
        html_url=event.check_run["html_url"],
    )
    structured_event = CheckRunEventParser(
        action=event.action,
        check_run=check_run_data,
        subscription_event=_map_subscription_event_parser(event.subscription_event),
    )
    return encoder.encode(structured_event).decode("utf-8")


def serialize_comment_event(event: CommentEvent) -> str:
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
    structured_event = CommentEventParser(
        action=event.action,
        comment_type=event.comment_type,
        comment=comment_data,
        subscription_event=_map_subscription_event_parser(event.subscription_event),
    )
    return encoder.encode(structured_event).decode("utf-8")


def serialize_pull_request_event(event: PullRequestEvent) -> str:
    pull_request_data = PullRequestEventDataParser(
        id=event.pull_request["id"],
        title=event.pull_request["title"],
        description=event.pull_request["description"],
        head=PullRequestBranchParser(
            ref=event.pull_request["head"]["ref"],
            sha=event.pull_request["head"]["sha"],
        ),
        base=PullRequestBranchParser(
            ref=event.pull_request["base"]["ref"],
            sha=event.pull_request["base"]["sha"],
        ),
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
    structured_event = PullRequestEventParser(
        action=event.action,
        pull_request=pull_request_data,
        subscription_event=_map_subscription_event_parser(event.subscription_event),
    )
    return encoder.encode(structured_event).decode("utf-8")


def deserialize_event(event: str, event_type: EventTypeHint) -> EventType:
    """
    Given an encoded string return a deserialized event.
    """
    if event_type == "check_run":
        return deserialize_check_run_event(event)
    elif event_type == "comment":
        return deserialize_comment_event(event)
    elif event_type == "pull_request":
        return deserialize_pull_request_event(event)
    else:
        assert_never(event_type)


def deserialize_raw_event(event: SubscriptionEvent) -> EventType | None:
    """
    Subscription events are the raw data received by Sentry. We can deserialize them into a more
    specific type (e.g. a pull-request or check-run). This function transforms the raw payload
    into its specific type and also returns a string identifier indicating what type of event was
    deserialized.

    The type hint string value could be derived from an isinstance check but then typed
    dictionaries would not work.
    """
    if event["type"] == "github":
        return deserialize_github_event(event)
    elif event["type"] == "github_enterprise":
        return deserialize_github_event(event)
    elif event["type"] == "bitbucket":
        raise SCMProviderNotSupported("Bitbucket has not been implemented.")
    elif event["type"] == "gitlab":
        raise SCMProviderNotSupported("GitLab has not been implemented.")
    else:
        assert_never(event["type"])


def serialize_event(event: EventType) -> str:
    """
    EventType serialization function. Serializes a payload based on its type hint. Again could be
    handled by an isinstance check. Or a type protocol which enforces that EventTypes provide a
    serialization method.
    """
    if isinstance(event, CheckRunEvent):
        return serialize_check_run_event(event)
    elif isinstance(event, CommentEvent):
        return serialize_comment_event(event)
    elif isinstance(event, PullRequestEvent):
        return serialize_pull_request_event(event)
    else:
        assert_never(event)


# $$$$$$$\            $$\       $$\ $$\           $$\
# $$  __$$\           $$ |      $$ |\__|          $$ |
# $$ |  $$ |$$\   $$\ $$$$$$$\  $$ |$$\  $$$$$$$\ $$$$$$$\   $$$$$$\   $$$$$$\
# $$$$$$$  |$$ |  $$ |$$  __$$\ $$ |$$ |$$  _____|$$  __$$\ $$  __$$\ $$  __$$\
# $$  ____/ $$ |  $$ |$$ |  $$ |$$ |$$ |\$$$$$$\  $$ |  $$ |$$$$$$$$ |$$ |  \__|
# $$ |      $$ |  $$ |$$ |  $$ |$$ |$$ | \____$$\ $$ |  $$ |$$   ____|$$ |
# $$ |      \$$$$$$  |$$$$$$$  |$$ |$$ |$$$$$$$  |$$ |  $$ |\$$$$$$$\ $$ |
# \__|       \______/ \_______/ \__|\__|\_______/ \__|  \__| \_______|\__|


PRODUCE_TO_LISTENER = Callable[[str, EventTypeHint, str, HybridCloudSilo], None]


def produce_to_listeners(
    event: SubscriptionEvent,
    silo: HybridCloudSilo,
    produce_to_listener: PRODUCE_TO_LISTENER,
    stream: SourceCodeManagerEventStream = scm_event_stream,
) -> None:
    """
    Accepts a raw SubscriptionEvent and attempts to determine its type before sending it to the
    event-type's listeners to be processed.

    :param event:
    :param silo: Events are processed in the hybrid-cloud silo they are received in.
    :param produce_to_listener:
    """
    parsed_event = deserialize_raw_event(event)

    # Most events are not supported. We drop them. They could be processed elsewhere but they're
    # not processed by the unified SCM platform.
    if parsed_event is None:
        return None

    message = serialize_event(parsed_event)

    if isinstance(parsed_event, CheckRunEvent):
        event_type_hint = "check_run"
        listeners = list(stream.check_run_listeners.keys())
    elif isinstance(parsed_event, CommentEvent):
        event_type_hint = "comment"
        listeners = list(stream.comment_listeners.keys())
    elif isinstance(parsed_event, PullRequestEvent):
        event_type_hint = "pull_request"
        listeners = list(stream.pull_request_listeners.keys())
    else:
        assert_never(parsed_event)

    for listener in listeners:
        produce_to_listener(message, cast(EventTypeHint, event_type_hint), listener, silo)


def produce_to_listener(
    message: str,
    event_type_hint: EventTypeHint,
    listener_name: str,
    silo: HybridCloudSilo,
) -> None:
    if silo == "control":
        run_webhook_handler_control_task.delay(listener_name, message, event_type_hint)
    elif silo == "region":
        run_webhook_handler_region_task.delay(listener_name, message, event_type_hint)
    else:
        assert_never(silo)


@instrumented_task(
    silo_mode=SiloMode.CONTROL,
    name="sentry.scm.run_webhook_handler_control_task",
    namespace=scm_tasks,
    processing_deadline_duration=10,
)
def run_webhook_handler_control_task(
    listener: str, message: str, event_type_hint: EventTypeHint
) -> None:
    run_listener(
        listener,
        message,
        event_type_hint,
        stream=scm_event_stream,
        get_current_time=time.time,
        report_error=report_error_to_sentry,
        record_count=record_count_metric,
        record_distribution=record_distribution_metric,
        record_timer=record_timer_metric,
    )


@instrumented_task(
    silo_mode=SiloMode.REGION,
    name="sentry.scm.run_webhook_handler_region_task",
    namespace=scm_tasks,
    processing_deadline_duration=10,
)
def run_webhook_handler_region_task(
    listener: str, message: str, event_type_hint: EventTypeHint
) -> None:
    run_listener(
        listener,
        message,
        event_type_hint,
        stream=scm_event_stream,
        get_current_time=time.time,
        report_error=report_error_to_sentry,
        record_count=record_count_metric,
        record_distribution=record_distribution_metric,
        record_timer=record_timer_metric,
    )


def report_error_to_sentry(e: Exception) -> None:
    """Typing wrapper around sentry_sdk.capture_exception."""
    sentry_sdk.capture_exception(e)


def record_count_metric(key: str, amount: int, tags: dict[str, str]) -> None:
    """Typing wrapper around metrics.incr."""
    metrics.incr(key, amount, tags=tags)


def record_distribution_metric(key: str, amount: int, tags: dict[str, str], unit: str) -> None:
    """Typing wrapper around metrics.distribution."""
    metrics.distribution(key, amount, tags=tags, unit=unit)


def record_timer_metric(key: str, amount: float, tags: dict[str, str]) -> None:
    """Typing wrapper around metrics.distribution."""
    metrics.distribution(key, amount, tags=tags)


METRIC_PREFIX = "sentry.scm.run_listener"


def run_listener(
    listener: str,
    event_data: str,
    event_type_hint: EventTypeHint,
    *,
    stream: SourceCodeManagerEventStream,
    get_current_time: Callable[[], float] = time.monotonic,
    report_error: Callable[[Exception], None] = report_error_to_sentry,
    record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    record_distribution: Callable[
        [str, int, dict[str, str], str], None
    ] = record_distribution_metric,
    record_timer: Callable[[str, float, dict[str, str]], None] = record_timer_metric,
) -> None:
    """Execute an SCM platform listener."""
    start = get_current_time()

    try:
        event = deserialize_event(event_data, event_type_hint)
    except msgspec.MsgspecError as e:
        report_error(e)
        record_count(f"{METRIC_PREFIX}.failed", 1, {"reason": "parse", "fn": listener})
        return None

    if isinstance(event, CheckRunEvent):
        exec_listener(listener, stream.check_run_listeners, event, record_count)
    elif isinstance(event, CommentEvent):
        exec_listener(listener, stream.comment_listeners, event, record_count)
    elif isinstance(event, PullRequestEvent):
        exec_listener(listener, stream.pull_request_listeners, event, record_count)
    else:
        assert_never(event)

    end = get_current_time()
    received_at = event.subscription_event["received_at"]

    # Success and timing metrics are tracked below. These metrics enable us to validate the
    # performance of the platform. Failure metrics are recorded elsewhere but follow the same
    # pattern. Failed listeners should never influence timing metrics. Failures can execute
    # abnormally quickly because they are not performing the full computation.
    #
    # Metrics are tagged by the listener's name so we can break down a metric by listener and
    # identify slow listeners.
    #
    #   * real_time indicates the total time taken from webhook received to webhook processed.
    #   * task_time indicates the total time taken to process the task from start to finish.
    #   * queue_time identifies the time from webhook received to task started. It measures total
    #     system latency.
    record_count(f"{METRIC_PREFIX}.success", 1, {"fn": listener})
    record_distribution(
        f"{METRIC_PREFIX}.message.size",
        len(event_data),
        {"provider": event.subscription_event["type"], "event_type_hint": event_type_hint},
        "byte",
    )
    record_timer(f"{METRIC_PREFIX}.queue_time", start - received_at, {"fn": listener})
    record_timer(f"{METRIC_PREFIX}.task_time", end - start, {"fn": listener})
    record_timer(f"{METRIC_PREFIX}.real_time", end - received_at, {"fn": listener})


def exec_listener[T](
    listener: str,
    listeners: dict[str, Callable[[T], None]],
    arg: T,
    record_count: Callable[[str, int, dict[str, str]], None],
) -> None:
    """Record error metrics before raising."""
    if listener not in listeners:
        record_count(f"{METRIC_PREFIX}.failed", 1, {"reason": "not-found", "fn": listener})
        return None

    try:
        return listeners[listener](arg)
    except Exception:
        record_count(f"{METRIC_PREFIX}.failed", 1, {"reason": "internal", "fn": listener})
        raise
