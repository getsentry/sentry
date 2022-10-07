from __future__ import annotations

import concurrent.futures
import logging
import re
import time
import typing
import zlib
from collections import deque
from concurrent.futures import Future
from io import BytesIO
from typing import Any, Callable, Deque, Mapping, MutableMapping, NamedTuple, Optional, cast
from urllib.parse import parse_qs, urlencode, urlparse

import msgpack
import sentry_sdk
from arroyo import Partition
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, Position
from django.conf import settings

from sentry.models import File
from sentry.replays.cache import RecordingSegmentPart, RecordingSegmentParts
from sentry.replays.consumers.recording.types import (
    RecordingSegmentChunkMessage,
    RecordingSegmentHeaders,
    RecordingSegmentMessage,
)
from sentry.replays.models import ReplayRecordingSegment
from sentry.utils import json
from sentry.utils.sdk import configure_scope

logger = logging.getLogger("sentry.replays")

CACHE_TIMEOUT = 3600
COMMIT_FREQUENCY_SEC = 1


class MissingRecordingSegmentHeaders(ValueError):
    pass


class ReplayRecordingMessageFuture(NamedTuple):
    """
    Map a submitted message to a Future returned by the Producer.
    This is useful for being able to commit the latest offset back
    to the original consumer.
    """

    message: Message[KafkaPayload]
    future: Future[None]


class ProcessRecordingSegmentStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
    ) -> None:
        self.__closed = False
        self.__futures: Deque[ReplayRecordingMessageFuture] = deque()
        self.__threadpool = concurrent.futures.ThreadPoolExecutor()
        self.__commit = commit
        self.__commit_data: MutableMapping[Partition, Position] = {}
        self.__last_committed: float = 0

    def _process_chunk(
        self, message_dict: RecordingSegmentChunkMessage, message: Message[KafkaPayload]
    ) -> None:
        cache_prefix = replay_recording_segment_cache_id(
            project_id=message_dict["project_id"],
            replay_id=message_dict["replay_id"],
            segment_id=message_dict["id"],
        )

        part = RecordingSegmentPart(cache_prefix)
        part[message_dict["chunk_index"]] = message_dict["payload"]

    def _process_headers(
        self, recording_segment_with_headers: bytes
    ) -> tuple[RecordingSegmentHeaders, bytes]:
        # split the recording payload by a newline into the headers and the recording
        try:
            recording_headers, recording_segment = recording_segment_with_headers.split(b"\n", 1)
        except ValueError:
            raise MissingRecordingSegmentHeaders
        return json.loads(recording_headers), recording_segment

    def _store(
        self,
        message_dict: RecordingSegmentMessage,
        parts: RecordingSegmentParts,
    ) -> None:
        with sentry_sdk.start_transaction(
            op="replays.consumer.flush_batch", description="Replay recording segment stored."
        ):
            sentry_sdk.set_extra("replay_id", message_dict["replay_id"])

            parts_iterator = iter(parts)

            try:
                headers, part = self._process_headers(next(parts_iterator))
            except MissingRecordingSegmentHeaders:
                logger.warning(f"missing header on {message_dict['replay_id']}")
                return

            recording_segment_parts = [part]
            recording_segment_parts.extend(part for part in parts_iterator)

            # The parts were gzipped by the SDK and disassembled by Relay. In this step we can
            # blindly merge the bytes objects into a single bytes object.
            recording_segment = b"".join(recording_segment_parts)

            # Post-processing steps.
            recording_segment = zlib.decompress(recording_segment)
            recording_segment = strip_pii_from_rrweb(recording_segment)
            recording_segment = zlib.compress(recording_segment)

            # create a File for our recording segment.
            recording_segment_file_name = f"rr:{message_dict['replay_id']}:{headers['segment_id']}"
            file = File.objects.create(
                name=recording_segment_file_name,
                type="replay.recording",
            )
            file.putfile(
                BytesIO(recording_segment),
                blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE,
            )
            # associate this file with an indexable replay_id via ReplayRecordingSegment
            ReplayRecordingSegment.objects.create(
                replay_id=message_dict["replay_id"],
                project_id=message_dict["project_id"],
                segment_id=headers["segment_id"],
                file_id=file.id,
            )
            # delete the recording segment from cache after we've stored it
            parts.drop()

            # TODO: how to handle failures in the above calls. what should happen?
            # also: handling same message twice?

    def _process_recording(
        self, message_dict: RecordingSegmentMessage, message: Message[KafkaPayload]
    ) -> None:
        cache_prefix = replay_recording_segment_cache_id(
            project_id=message_dict["project_id"],
            replay_id=message_dict["replay_id"],
            segment_id=message_dict["replay_recording"]["id"],
        )
        parts = RecordingSegmentParts(
            prefix=cache_prefix, num_parts=message_dict["replay_recording"]["chunks"]
        )

        # in a thread, upload the recording segment and delete the cached version
        self.__futures.append(
            ReplayRecordingMessageFuture(
                message,
                self.__threadpool.submit(
                    self._store,
                    message_dict=message_dict,
                    parts=parts,
                ),
            )
        )

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        try:
            with sentry_sdk.start_transaction(
                op="replays.consumer.process_recording",
                description="Replay recording segment message received.",
            ):
                message_dict = msgpack.unpackb(message.payload.value)
                self._configure_sentry_scope(message_dict)

                if message_dict["type"] == "replay_recording_chunk":
                    sentry_sdk.set_extra("replay_id", message_dict["replay_id"])
                    with sentry_sdk.start_span(op="replay_recording_chunk"):
                        self._process_chunk(
                            cast(RecordingSegmentChunkMessage, message_dict), message
                        )
                if message_dict["type"] == "replay_recording":
                    sentry_sdk.set_extra("replay_id", message_dict["replay_id"])
                    with sentry_sdk.start_span(op="replay_recording"):
                        self._process_recording(
                            cast(RecordingSegmentMessage, message_dict), message
                        )
        except Exception:
            # avoid crash looping on bad messsages for now
            logger.exception(
                "Failed to process replay recording message", extra={"offset": message.offset}
            )

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.close()
        self.__threadpool.shutdown(wait=False)

    def join(self, timeout: Optional[float] = None) -> None:
        start = time.time()

        # Immediately commit all the offsets we have popped from the queue.
        self.__throttled_commit(force=True)

        # Any remaining items in the queue are flushed until the process is terminated.
        while self.__futures:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__futures)} futures in queue")
                break

            # Pop the future from the queue.  If it succeeds great but if not it will be discarded
            # on the next loop iteration without commit.  An error will be logged.
            message, future = self.__futures.popleft()

            try:
                future.result(remaining)
                self.__commit({message.partition: Position(message.offset, message.timestamp)})
            except Exception:
                logger.exception(
                    "Async future failed in replays recording-segment consumer.",
                    extra={"offset": message.offset},
                )

    def poll(self) -> None:
        while self.__futures:
            message, future = self.__futures[0]
            if not future.done():
                break

            if future.exception():
                logger.error(
                    "Async future failed in replays recording-segment consumer.",
                    exc_info=future.exception(),
                    extra={"offset": message.offset},
                )

            self.__futures.popleft()
            self.__commit_data[message.partition] = Position(message.next_offset, message.timestamp)

        self.__throttled_commit()

    def __throttled_commit(self, force: bool = False) -> None:
        now = time.time()

        if (now - self.__last_committed) >= COMMIT_FREQUENCY_SEC or force is True:
            if self.__commit_data:
                self.__commit(self.__commit_data)
                self.__last_committed = now
                self.__commit_data = {}

    def _configure_sentry_scope(self, message_dict: dict[str, Any]) -> None:
        with configure_scope() as scope:
            scope.set_tag("replay_id", message_dict["replay_id"])
            scope.set_tag("project_id", message_dict["project_id"])
            # TODO: add replay sdk version once added


def replay_recording_segment_cache_id(project_id: int, replay_id: str, segment_id: str) -> str:
    return f"{project_id}:{replay_id}:{segment_id}"


SKIP_NODES = {"style", "script"}
PATTERNS = [
    # US SSN
    re.compile(r"(?x)\b([0-9]{3}-[0-9]{2}-[0-9]{4})\b"),
    # UUIDs
    re.compile(r"(?ix)\b[a-z0-9]{8}-?[a-z0-9]{4}-?[a-z0-9]{4}-?[a-z0-9]{4}-?[a-z0-9]{12}\b"),
    # Email
    re.compile(r"(?x)\b[a-zA-Z0-9.!\#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\b"),
    # IMEI
    re.compile(
        r"""(?x)
        \b
            (\d{2}-?
             \d{6}-?
             \d{6}-?
             \d{1,2})
        \b
        """
    ),
    # Credit Card
    re.compile(
        r"""(?x)
        \b(
            (?:  # vendor specific prefixes
                  3[47]\d      # amex (no 13-digit version) (length: 15)
                | 4\d{3}       # visa (16-digit version only)
                | 5[1-5]\d\d   # mastercard
                | 65\d\d       # discover network (subset)
                | 6011         # discover network (subset)
            )
            # "wildcard" remainder (allowing dashes in every position because of variable length)
            ([-\s]?\d){12}
        )\b
    """
    ),
    # PEM Key
    re.compile(
        r"""(?sx)
        (?:
            -----
            BEGIN[A-Z\ ]+(?:PRIVATE|PUBLIC)\ KEY
            -----
            [\t\ ]*\r?\n?
        )
        (.+?)
        (?:
            \r?\n?
            -----
            END[A-Z\ ]+(?:PRIVATE|PUBLIC)\ KEY
            -----
        )
    """
    ),
    # Auth URL
    re.compile(
        r"""(?x)
        \b(?:
            (?:[a-z0-9+-]+:)?//
            ([a-zA-Z0-9%_.-]+(?::[a-zA-Z0-9%_.-]+)?)
        )@
    """
    ),
    # Password
    re.compile(
        r"(?i)(password|secret|passwd|api_key|apikey|access_token|auth|credentials|mysql_pwd|stripetoken|privatekey|private_key|github_token)"
    ),
]


def strip_pii_from_rrweb(rrweb_output: bytes) -> bytes:
    # Result must be decompressed before it can be used. Currently the SDK gzips rrweb payloads.
    events = json.loads(rrweb_output)

    for event in events:
        event_type = event.get("type")
        if event_type == 2:
            recurse_nodes(event["data"]["node"]["childNodes"])
        elif event["type"] == 3:
            recurse_nodes(i["node"] for i in event["data"].get("adds", []) if "node" in i)
        elif event_type == 5:
            payload = event["data"]["payload"]
            if payload.get("op") == "performanceSpan":
                payload["description"] = replace_query_args(payload["description"])
            elif payload.get("category") == "console":
                payload["message"] = replace_detectable_pii(payload["message"])

    # Result must be gzipped before it is uploaded to blob storage.
    return json.dumps(events).encode()


def recurse_nodes(nodes: typing.Iterator[dict[str, typing.Any]]) -> None:
    for node in nodes:
        if node["type"] == 2:
            if node["tagName"] == "img":
                node["attributes"]["src"] = "#"
            elif node["tagName"] not in SKIP_NODES:
                recurse_nodes(node["childNodes"])
        elif node["type"] == 3:
            node["textContent"] = replace_detectable_pii(node["textContent"])


def replace_query_args(url: str) -> str:
    """Replace detectable PII in a navigation events request args."""
    parts = urlparse(url)

    params_dict = parse_qs(parts.query)
    for key in params_dict:
        params_dict[key] = [replace_detectable_pii(v) for v in params_dict[key]]

    # "parts" is immutable by default but the "_replace" method allows us to bypass this
    # constraint. "_replace" is NOT a private method. It is underscored to prevent collisions with
    # user-defined namedtuple parameter names.
    parts = parts._replace(query=urlencode(params_dict))

    return parts.geturl()


def replace_detectable_pii(value: str) -> str:
    """Replace detectable PII."""
    for pattern in PATTERNS:
        value = pattern.sub(replacement_fn, value)
    return value


def replacement_fn(match_obj: typing.Any) -> str:
    """Replace text-content with asterisks."""
    return "*" * len(match_obj.group(0))
