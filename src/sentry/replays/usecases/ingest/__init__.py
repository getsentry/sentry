from __future__ import annotations

import logging
import zlib
from datetime import datetime, timezone
from typing import Optional

from django.conf import settings
from sentry_sdk import Hub
from sentry_sdk.tracing import Span

from sentry import options
from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.replays.feature import has_feature_access
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, make_storage_driver
from sentry.replays.usecases.ingest.decode import RecordingSegment, decode_recording_message
from sentry.replays.usecases.ingest.dom_index import parse_and_emit_replay_actions
from sentry.signals import first_replay_received
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger("sentry.replays")


@metrics.wraps("replays.usecases.ingest.ingest_recording")
def ingest_recording(message: bytes, transaction: Span, current_hub: Hub) -> None:
    """Ingest non-chunked recording messages."""
    with current_hub:
        with transaction.start_child(
            op="replays.usecases.ingest.ingest_recording",
            description="ingest_recording",
        ):
            decoded_message = decode_recording_message(message)
            if decoded_message is not None:
                _ingest_recording(decoded_message, transaction)


def _ingest_recording(message: RecordingSegment, transaction: Span) -> None:
    """Ingest recording messages."""
    # Normalize ingest data into a standardized ingest format.
    segment_data = RecordingSegmentStorageMeta(
        project_id=message["project_id"],
        replay_id=message["replay_id"],
        segment_id=message["segment_id"],
        retention_days=message["retention_days"],
    )

    # Using a blob driver ingest the recording-segment bytes.  The storage location is unknown
    # within this scope.
    driver = make_storage_driver(message["org_id"])
    driver.set(segment_data, message["payload"])

    replay_click_post_processor(message, transaction)

    # The first segment records an accepted outcome. This is for billing purposes. Subsequent
    # segments are not billed.
    recording_billing_outcome(message)

    transaction.finish()


def decompress(data: bytes) -> bytes:
    """Return decompressed bytes."""
    return data if data.startswith(b"[") else zlib.decompress(data, zlib.MAX_WBITS | 32)


def replay_click_post_processor(message: RecordingSegment, transaction: Span) -> None:
    if not has_feature_access(
        message["org_id"],
        options.get("replay.ingest.dom-click-search"),
        settings.SENTRY_REPLAYS_DOM_CLICK_SEARCH_ALLOWLIST,
    ):
        _report_size_metrics(size_compressed=len(message["payload"]))
        return None

    try:
        with metrics.timer("replays.usecases.ingest.decompress_and_parse"):
            decompressed_segment = decompress(message["payload"])
            parsed_segment_data = json.loads(decompressed_segment, use_rapid_json=True)
            _report_size_metrics(len(message["payload"]), len(decompressed_segment))

        # Emit DOM search metadata to Clickhouse.
        with transaction.start_child(
            op="replays.usecases.ingest.parse_and_emit_replay_actions",
            description="parse_and_emit_replay_actions",
        ):
            parse_and_emit_replay_actions(
                retention_days=message["retention_days"],
                project_id=message["project_id"],
                replay_id=message["replay_id"],
                segment_data=parsed_segment_data,
            )
    except Exception:
        logging.exception(
            "Failed to parse recording org={}, project={}, replay={}, segment={}".format(
                message["org_id"],
                message["project_id"],
                message["replay_id"],
                message["segment_id"],
            )
        )


def recording_billing_outcome(message: RecordingSegment) -> None:
    """Record a billing outcome."""
    if message["segment_id"] != 0:
        return None

    try:
        project = Project.objects.get_from_cache(id=message["project_id"])
    except Project.DoesNotExist:
        logger.warning(
            "Recording segment was received for a project that does not exist.",
            extra={"project_id": message["project_id"], "replay_id": message["replay_id"]},
        )
        return None

    if not project.flags.has_replays:
        first_replay_received.send_robust(project=project, sender=Project)

    track_outcome(
        org_id=message["org_id"],
        project_id=message["project_id"],
        key_id=message["key_id"],
        outcome=Outcome.ACCEPTED,
        reason=None,
        timestamp=datetime.utcfromtimestamp(message["received"]).replace(tzinfo=timezone.utc),
        event_id=message["replay_id"],
        category=DataCategory.REPLAY,
        quantity=1,
    )


def _report_size_metrics(
    size_compressed: Optional[int] = None, size_uncompressed: Optional[int] = None
) -> None:
    if size_compressed:
        metrics.timing("replays.usecases.ingest.size_compressed", size_compressed)
    if size_uncompressed:
        metrics.timing("replays.usecases.ingest.size_uncompressed", size_uncompressed)
