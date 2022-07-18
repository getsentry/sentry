from typing import TypedDict


class RecordingChunkMessage(TypedDict):
    payload: bytes
    replay_id: str
    id: str
    project_id: int
    chunk_index: int


class ReplayRecording(TypedDict):
    chunks: int
    id: str


class RecordingHeaders(TypedDict):
    sequence_id: int


class RecordingMessage(TypedDict):
    replay_id: str
    project_id: int
    recording_headers: RecordingHeaders
    replay_recording: ReplayRecording
