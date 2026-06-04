# Replays SDK Event

This file defines the contract between the recording consumer and its producers. All messages are transmitted as `msgpack` encoded bytes. Messages smaller than 1MB in size are processed as one message. Their structure is defined in the "Small Recordings" section. All other message types are defined in the "Large Recordings" section.

**Authors:**
@cmanallen

## Small Recordings

### Replay Recording Not Chunked

| Column     | Type         | Description                                       |
| ---------- | ------------ | ------------------------------------------------- |
| type       | string       | Literal: replay_recording_not_chunked             |
| replay_id  | string       | -                                                 |
| key_id     | Optonal[int] | -                                                 |
| org_id     | int          | -                                                 |
| project_id | int          | -                                                 |
| received   | int          | Unix timestamp of when the event was received     |
| payload    | bytes        | JSON encoded headers are prefixed to the payload. |

- Request (application/octet-stream)

  ```python
  {
    "type": "replay_recording_not_chunked",
    "replay_id": "515539018c9b4260a6f999572f1661ee",
    "key_id": 1,
    "org_id": 132,
    "project_id": 10459681,
    "received": 1342632621,
    "payload": b"{'segment_id': 0}\n\x14ftypqt\x00\x00\x00\x00qt\x00\x00x08wide\x03\xbdd\x11mdat"
  }
  ```

## Large Recordings

### Replay Recording Chunk

| Column      | Type   | Description                     |
| ----------- | ------ | ------------------------------- |
| type        | string | Literal: replay_recording_chunk |
| replay_id   | string | -                               |
| project_id  | int    | -                               |
| chunk_index | int    | -                               |
| id          | string | -                               |
| payload     | bytes  | -                               |

- Request (application/octet-stream)

  ```python
  {
    "type": "replay_recording_chunk",
    "replay_id": "515539018c9b4260a6f999572f1661ee",
    "project_id": 1,
    "chunk_index": 10,
    "id": "e4a28052c54743a286be419c9d168ef5",
    "payload": b"\x14ftypqt\x00\x00\x00\x00qt\x00\x00x08wide\x03\xbdd\x11mdat"
  }
  ```

### Replay Recording

| Column           | Type         | Description                                           |
| ---------------- | ------------ | ----------------------------------------------------- |
| type             | string       | Literal: replay_recording                             |
| replay_id        | string       | -                                                     |
| key_id           | Optonal[int] | -                                                     |
| org_id           | int          | -                                                     |
| project_id       | int          | -                                                     |
| received         | int          | Unix timestamp of when the event was received         |
| replay_recording | dict         | Contains the number of chunks and a unique identifier |

- Request (application/octet-stream)

  ```python
  {
    "type": "replay_recording",
    "replay_id": "515539018c9b4260a6f999572f1661ee",
    "key_id": 1,
    "org_id": 132,
    "project_id": 10459681,
    "received": 1342632621,
    "replay_recording": {
        "id": "e4a28052c54743a286be419c9d168ef5",
        "chunks": 5
    }
  }
  ```
