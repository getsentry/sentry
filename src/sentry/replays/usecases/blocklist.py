from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.replays.constants import REPLAY_MOBILE_BLOCK_LIST


def mobile_processing_is_blocked(message: ReplayRecording) -> bool:
    return message.get("replay_video") is not None and message["org_id"] in REPLAY_MOBILE_BLOCK_LIST
