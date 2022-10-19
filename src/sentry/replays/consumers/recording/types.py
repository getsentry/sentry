from __future__ import annotations

from typing import TypedDict


class ReplayRecordingSegment(TypedDict):
    chunks: int  # the number of chunks for this segment
    id: str  # a uuid that individualy identifies a recording segment


class RecordingSegmentHeaders(TypedDict):
    segment_id: int


class RecordingSegmentChunkMessage(TypedDict):
    payload: bytes
    replay_id: str  # the uuid of the encompassing replay event
    id: str  # a uuid that individualy identifies a recording segment
    project_id: int
    chunk_index: int  # each segment is split into chunks to fit into kafka


class RecordingSegmentMessage(TypedDict):
    replay_id: str  # the uuid of the encompassing replay event
    org_id: int
    key_id: int | None
    received: int
    project_id: int
    replay_recording: ReplayRecordingSegment
