from typing import Any, Mapping

EVENT_PAYLOAD_VERSIONS: Mapping[int, Mapping[str, Any]] = {
    0: {
        "type": "object",
        "properties": {
            # required properties
            "event_id": {"type": "string", "minLength": 1},
            "platform": {"type": "string", "minLength": 1},
            "project_id": {"type": "string", "minLength": 1},
            "tags": {"type": "object"},
            "timestamp": {"type": "string", "format": "date-time"},
            "message_timestamp": {"type": "string", "format": "date-time"},
            # "title": {"type": "string", "minLength": 1}, leaving this out, for now
            # non-required properties
            "breadcrumbs": {"type": "object"},
            "contexts": {"type": "object"},
            "dist": {
                "type": "object",
                "properties": {
                    "dist": {"type": "string", "minLength": 1},
                    "release": {"type": "string", "minLength": 1},
                },
                "required": ["dist", "release"],
            },
            "environment": {"type": "string", "minLength": 1},
            "extra": {"type": "object"},
            "message": {"type": "object"},
            "modules": {"type": "object"},
            "release": {"type": "string", "minLength": 1},
            "request": {"type": "object"},
            "sdk": {"type": "object"},
            "server_name": {"type": "string", "minLength": 1},
            "trace_id": {"type": "string", "minLength": 1},
            "transaction": {"type": "string", "minLength": 1},
            "user": {"type": "object"},
        },
        "required": [
            "event_id",
            "platform",
            "project_id",
            "tags",
        ],  # title will be required, if enabled
        "additionalProperties": False,
    },
}
