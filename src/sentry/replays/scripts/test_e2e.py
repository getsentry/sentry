import logging
import uuid
import zlib

import msgpack
import requests

from sentry.utils import json

logger = logging.getLogger()


def produce_replay_video_envelope(dsn: str, replay_video: bytes) -> None:
    parts = dsn.split("/")
    project_id = parts.pop()
    dsn_url = "/".join(parts) + f"/api/{project_id}/envelope/"

    replay_id = uuid.uuid4().hex
    logger.info("Replay envelope emitted with ID: %s", replay_id)

    # Replay Envelope Headers
    headers = {"event_id": replay_id, "dsn": dsn}

    # Replay event envelope item.
    replay_event = json.dumps(
        {
            "event_id": replay_id,
            "replay_id": replay_id,
            "segment_id": 0,
            "replay_type": "session",
            "error_sample_rate": 1,
            "session_sample_rate": 1,
            "timestamp": 1709314376,
            "replay_start_timestamp": 1709314376 - 30,
            "urls": [],
            "error_ids": [],
            "trace_ids": [],
            "platform": "native",
            "release": "release",
            "dist": "mydist",
            "environment": "production",
            "tags": [],
            # Important to send the SDK.  Apparently the client doesn't know how to act
            # if you don't!
            "sdk": {
                "name": "sentry.javascript.react",
                "version": "7.47.0",
            },
            "user": {
                "id": "123",
                "username": "Replay Video Test!",
                "email": "replay-video@test.com",
                "ip_address": "0.0.0.0",
            },
        }
    ).encode()

    # Replay recording envelope item.
    replay_recording = zlib.compress(
        json.dumps(
            [
                {
                    "type": 5,
                    "timestamp": 1681846559381,
                    "data": {
                        "tag": "video",
                        "payload": {
                            "segmentId": 0,
                            "size": 3440,
                            "duration": 1000,
                            "encoding": "mp4",
                            "container": "",
                            "height": 720,
                            "width": 1280,
                            "frameCount": 50,
                            "frameRateType": "constant",
                            "frameRate": 10,
                            "left": 0,
                            "top": 0,
                        },
                    },
                }
            ]
        ).encode()
    )
    replay_recording = b'{"segment_id":0}\n' + replay_recording

    replay_video_payload = msgpack.packb(
        {
            "replay_event": replay_event,
            "replay_recording": replay_recording,
            "replay_video": replay_video,
        }
    )

    replay_video_headers = {
        "type": "replay_video",
        "length": len(replay_video_payload),
        "content_type": "application/octet-stream",
        "filename": "video.blob",
    }

    payload = (
        json.dumps(headers).encode()
        + b"\n"
        + json.dumps(replay_video_headers).encode()
        + b"\n"
        + replay_video_payload
    )

    response = requests.post(dsn_url, data=payload)
    logger.info(response.content)
    assert response.status_code == 200
    logger.info("Successfully ingested id: %s", str(uuid.UUID(replay_id)))
