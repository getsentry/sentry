from typing import Any, Mapping

EVENT_PAYLOAD_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "properties": {
        # required properties
        "event_id": {"type": "string", "minLength": 1},
        "platform": {"type": "string", "minLength": 1},
        "project_id": {"type": "integer"},
        "tags": {"type": "object"},
        "timestamp": {"type": "string", "format": "date-time"},
        "received": {"type": "string", "format": "date-time"},
        # "title": {"type": "string", "minLength": 1}, leaving this out, for now
        # non-required properties
        "breadcrumbs": {
            "type": "array",
            "items": {"type": "object"},
        },
        "contexts": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "additionalProperties": {"type": "string", "minLength": 1},
            },
        },
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
        "message": {
            "type": "object",
            "properties": {
                "formatted": {"type": "string", "minLength": 1},
                "message": {"type": "string", "minLength": 1},
                "params": {"type": "array"},
            },
            "required": ["formatted"],
        },
        "modules": {"type": "object"},
        "release": {"type": "string", "minLength": 1},
        "request": {
            "type": "object",
            "properties": {
                "body_size": {"type": "number"},
                "cookies": {"type": ["array", "object"]},
                "data": {},
                "env": {"type": "object"},
                "fragment": {"type": "string", "minLength": 1},
                "headers": {"type": ["array", "object"]},
                "inferred_content_type": {"type": "string", "minLength": 1},
                "method": {"type": "string", "minLength": 1},
                "query_string": {"type": ["array", "object"]},
                "url": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "sdk": {
            "type": "object",
            "properties": {
                "integrations": {"type": "array"},
                "name": {"type": "string", "minLength": 1},
                "packages": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "minLength": 1},
                        "version": {"type": "string", "minLength": 1},
                    },
                    "additionalProperties": False,
                },
                "version": {
                    "type": "string",
                    "pattern": "^(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)$"
                    # MAJOR.MINOR.PATCH
                },
            },
            "required": ["name", "version"],
            "additionalProperties": False,
        },
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
        "timestamp",
    ],  # title will be required, if enabled
    "additionalProperties": False,
}
