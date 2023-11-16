import logging
import pathlib
from typing import Any, Mapping

from sentry.utils import json

logger = logging.getLogger(__name__)

LEGACY_EVENT_PAYLOAD_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "properties": {
        # required properties
        "event_id": {"type": "string", "minLength": 1},
        "level": {"type": "string", "minLength": 1},
        "platform": {"type": "string", "minLength": 1},
        "project_id": {"type": "integer"},
        "received": {"type": "string", "format": "date-time"},
        "tags": {"type": "object"},
        "timestamp": {"type": "string", "format": "date-time"},
        # non-required properties
        "breadcrumbs": {
            "type": ["array", "null"],
            "items": {"type": "object"},
        },
        "contexts": {
            "type": ["object", "null"],
            "additionalProperties": {
                "type": "object",
            },
        },
        "debug_meta": {
            "type": ["object", "null"],
            "properties": {
                "sdk_info": {"type": "object"},
                "images": {
                    "type": ["array", "null"],
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "minLength": 1},
                        },
                    },
                },
            },
        },
        "dist": {
            "type": ["object", "null"],
            "properties": {
                "dist": {"type": "string", "minLength": 1},
                "release": {"type": "string", "minLength": 1},
            },
            "required": ["dist", "release"],
        },
        "environment": {
            "type": ["string", "null"],
            "minLength": 1,
        },
        "extra": {
            "type": ["object", "null"],
        },
        "message": {
            "type": ["object", "null"],
            "properties": {
                "formatted": {"type": ["string", "null"], "minLength": 1},
                "message": {"type": ["string", "null"], "minLength": 1},
                "params": {"type": ["array", "object"]},
            },
            "required": ["formatted"],
        },
        "modules": {
            "type": ["object", "null"],
            "additionalProperties": {
                "type": ["string", "null"],
            },
        },
        "release": {"type": ["string", "null"], "minLength": 1},
        "request": {
            "type": ["object", "null"],
            "properties": {
                "body_size": {"type": ["number", "null"]},
                "cookies": {"type": ["array", "object", "null"]},
                "data": {},
                "env": {"type": ["object", "null"]},
                "fragment": {"type": ["string", "null"], "minLength": 1},
                "headers": {"type": ["array", "object", "null"]},
                "inferred_content_type": {"type": ["string", "null"], "minLength": 1},
                "method": {"type": ["string", "null"], "minLength": 1},
                "query_string": {"type": ["array", "object", "null"]},
                "url": {"type": ["string", "null"]},
            },
            "additionalProperties": False,
        },
        "sdk": {
            "type": ["object", "null"],
            "properties": {
                "integrations": {
                    "type": ["array", "null"],
                    "items": {"type": ["string", "null"], "minLength": 1},
                },
                "name": {"type": "string", "minLength": 1},
                "packages": {
                    "type": ["object", "null"],
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
        "server_name": {"type": ["string", "null"], "minLength": 1},
        "stacktrace": {
            "type": ["object", "null"],
            "properties": {
                "frames": {"type": ["array", "null"], "items": {"type": "object"}},
                "lang": {"type": ["string", "null"], "minLength": 1},
                "registers": {"type": ["object", "null"]},
                "snapshot": {"type": ["boolean", "null"]},
            },
            "additionalProperties": False,
        },
        "trace_id": {"type": ["string", "null"], "minLength": 1},
        "transaction": {"type": ["string", "null"], "minLength": 1},
        "user": {
            "type": ["object", "null"],
            "properties": {
                "data": {"type": ["object", "null"]},
                "email": {"type": ["string", "null"], "minLength": 1},
                "geo": {
                    "type": ["object", "null"],
                    "properties": {
                        "city": {"type": ["string", "null"], "minLength": 1},
                        "country_code": {"type": ["string", "null"], "minLength": 1},
                        "region": {"type": ["string", "null"], "minLength": 1},
                    },
                    "additionalProperties": False,
                },
                "id": {"type": ["string", "null"], "minLength": 1},
                "ip_address": {"type": ["string", "null"], "minLength": 1},
                "segment": {"type": ["string", "null"], "minLength": 1},
                "username": {"type": ["string", "null"], "minLength": 1},
            },
            "additionalProperties": True,
        },
    },
    "required": [
        "event_id",
        "level",
        "platform",
        "project_id",
        "tags",
        "timestamp",
    ],
    "additionalProperties": False,
}


_EVENT_PAYLOAD_SCHEMA_JSON_FILE = pathlib.PurePath(__file__).with_name("event.schema.json")

try:
    with open(_EVENT_PAYLOAD_SCHEMA_JSON_FILE) as f:
        EVENT_PAYLOAD_SCHEMA = json.load(f)

except Exception:
    logger.exception(
        "Failed to load Events schema from 'event.schema.json', falling back to hardcoded schema"
    )
    EVENT_PAYLOAD_SCHEMA = LEGACY_EVENT_PAYLOAD_SCHEMA
