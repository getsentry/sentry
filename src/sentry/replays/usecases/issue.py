import uuid
from typing import Any, Dict, List, Optional, TypedDict

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload
from django.conf import settings

from sentry.issues.grouptype import ReplaySlowClickType
from sentry.issues.producer import get_occurrence_producer, track_occurrence_producer_futures
from sentry.utils import json


class Event(TypedDict):
    environment: str
    event_id: str
    platform: str
    project_id: int
    received: int
    release: str
    tags: Dict[str, str]
    timestamp: int


class Evidence(TypedDict):
    name: str
    value: str
    important: bool


class Occurrence(TypedDict):
    culprint: Optional[str]
    detection_time: int
    event: Event
    evidence_data: Dict[str, Any]
    evidence_display: List[Evidence]
    fingerprint: str
    id: str
    issue_title: str
    level: Optional[str]
    project_id: int
    resource_id: str
    subtitle: str
    type: int


def new_slow_click_issue(
    environment: str,
    fingerprint: str,
    project_id: int,
    release: str,
    timestamp: int,
) -> None:
    """Produce a new slow click issue occurence to Kafka."""
    _new_issue_occurrence(
        environment=environment,
        fingerprint=fingerprint,
        issue_type=ReplaySlowClickType.type_id,
        platform="javascript",
        project_id=project_id,
        release=release,
        subtitle=ReplaySlowClickType.description,
        timestamp=timestamp,
        title="Slow Click Detected",
    )


def _new_issue_occurrence(
    environment: str,
    fingerprint: str,
    issue_type: int,
    platform: str,
    project_id: int,
    release: str,
    subtitle: str,
    timestamp: int,
    title: str,
) -> None:
    """Produce a new issue occurence to Kafka."""
    occurrence: Occurrence = {
        "culprint": None,
        "detection_time": timestamp,
        "event": {
            "environment": environment,
            "platform": platform,
            "project_id": project_id,
            "received": timestamp,
            "release": release,
            "tags": {},
            "timestamp": timestamp,
        },
        "evidence_data": {},
        "evidence_display": [],
        "fingerprint": fingerprint,
        "id": uuid.uuid4().hex,
        "issue_title": title,
        "level": "info",
        "project_id": project_id,
        "resource_id": None,
        "subtitle": subtitle,
        "type": issue_type,
    }

    # Helper function to initialize but to also re-use the global from the issue module if
    # the producer has already been initialized.
    occurrence_producer = get_occurrence_producer()

    # This is ripped from "sentry.issues.producer.produce_occurrence_to_kafka". We don't build
    # the `IssueOccurence` object because it requires an "event_id" parameter (which we don't
    # have). We build the event manually so this code is copied from there.
    occurence_json = KafkaPayload(None, json.dumps(occurrence).encode("utf-8"), [])
    future = occurrence_producer.produce(Topic(settings.KAFKA_INGEST_OCCURRENCES), occurence_json)

    # We don't produce to the topic synchronously so the above produce step will return a
    # future. We could have many of these futures at once so this function keeps track of the
    # number and errs if the value is too large.
    #
    # I don't anticipate we'll ever hit the configured limit considering the speed of our
    # consumer is significantly slower than the speed of producing messages to Kafka.  But its
    # fine to have it.
    #
    # In the event that a future produces an exception we don't have any ability to replay the
    # offending payload and try again.
    #
    # This function squashes index errors. A call to `future.result()` is present in a try
    # except block. As of writing I'm opening a separate pull request to address this issue.
    # If the IndexError has been resolved you can remove this comment.
    track_occurrence_producer_futures(future)
