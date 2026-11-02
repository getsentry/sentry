"""Signed, scope-bound source positions. Cursors contain no message content."""

from datetime import datetime
from math import isfinite

from django.core import signing

from sentry.ai_monitoring.transcript.pagination import (
    StreamPosition,
    TranscriptPosition,
)

SALT = "sentry.ai-monitoring.transcript.v1"
MAX_AGE = 3600


def encode_cursor(scope: str, start: datetime, end: datetime, position: TranscriptPosition) -> str:
    return signing.dumps(
        {
            "scope": scope,
            "range": [start.isoformat(), end.isoformat()],
            "start": [position.start.timestamp, position.start.offset],
            "end": [position.end.timestamp, position.end.offset],
            "last": position.last_event,
        },
        salt=SALT,
        compress=True,
    )


def decode_cursor(value: str, scope: str) -> tuple[datetime, datetime, TranscriptPosition]:
    def number(value: object) -> float:
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not isfinite(value):
            raise ValueError("Invalid transcript cursor timestamp")
        return value

    def integer(value: object) -> int:
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError("Invalid transcript cursor position")
        return value

    def stream(value: object) -> StreamPosition:
        if not isinstance(value, list) or len(value) != 2:
            raise ValueError("Invalid transcript cursor stream")
        return StreamPosition(number(value[0]), integer(value[1]))

    packet = signing.loads(value, salt=SALT, max_age=MAX_AGE)
    if not isinstance(packet, dict) or packet.get("scope") != scope:
        raise ValueError("Transcript cursor does not match this request")
    bounds = packet.get("range")
    if (
        not isinstance(bounds, list)
        or len(bounds) != 2
        or not all(isinstance(value, str) for value in bounds)
    ):
        raise ValueError("Invalid transcript cursor range")
    start, end = (datetime.fromisoformat(value) for value in bounds)
    if start.tzinfo is None or end.tzinfo is None or start > end:
        raise ValueError("Invalid transcript cursor range")
    last = packet.get("last")
    key = None
    if last is not None:
        if (
            not isinstance(last, list)
            or len(last) != 5
            or not isinstance(last[2], str)
            or not isinstance(last[3], str)
        ):
            raise ValueError("Invalid transcript cursor event")
        key = number(last[0]), integer(last[1]), last[2], last[3], integer(last[4])
    return (
        start,
        end,
        TranscriptPosition(stream(packet.get("start")), stream(packet.get("end")), key),
    )
