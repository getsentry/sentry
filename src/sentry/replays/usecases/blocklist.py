from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry import options


def mobile_processing_is_blocked(message: ReplayRecording) -> bool:
    denylist = options.get("organizations:replay-mobile-denylist")
    return message.get("replay_video") is not None and message["org_id"] in denylist
