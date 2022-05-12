from datetime import datetime

from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload

from sentry.sentry_metrics.last_seen_updater import retrieve_db_read_keys


def test_retrieve_db_read_keys_meta_field_present_with_db_keys():
    payload_bytes = bytes(
        """
        {
            "mapping_meta": {
                "c": {
                    "1001": "qwerty"
                },
                "f": {
                    "1002": "asdf"
                },
                "d": {
                    "2000": "abc",
                    "2001": "def",
                    "2002": "ghi"
                },
                "h": {
                    "3": "constant"
                }
            }
        }
        """,
        encoding="utf-8",
    )
    message_payload = KafkaPayload(
        key=bytes("fake-key", encoding="utf-8"), value=payload_bytes, headers=[]
    )

    message = Message(
        partition=Partition(Topic("fake-topic"), 1),
        offset=1,
        payload=message_payload,
        timestamp=datetime.now(),
    )
    key_set = retrieve_db_read_keys(message)
    assert key_set == {"2000", "2001", "2002"}
