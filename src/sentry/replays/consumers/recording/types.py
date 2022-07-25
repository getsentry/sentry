from typing import TypedDict


class RecordingSegmentChunkMessage(TypedDict):
    payload: bytes
    replay_id: str
    id: str
    project_id: int
    chunk_index: int


class ReplayRecordingSegment(TypedDict):
    chunks: int
    id: str


class RecordingSegmentHeaders(TypedDict):
    sequence_id: int


class RecordingSegmentMessage(TypedDict):
    replay_id: str
    project_id: int
    replay_recording: ReplayRecordingSegment
