from __future__ import absolute_import


SUBSCRIPTION_WRAPPER_SCHEMA = {
    "type": "object",
    "properties": {"version": {"type": "integer"}, "payload": {"type": "object"}},
    "required": ["version", "payload"],
    "additionalProperties": False,
}


SUBSCRIPTION_PAYLOAD_VERSIONS = {
    1: {
        "type": "object",
        "properties": {
            "subscription_id": {"type": "string", "minLength": 1},
            "values": {
                "type": "object",
                "minProperties": 1,
                "additionalProperties": {"type": "number"},
            },
            "timestamp": {"type": "number", "minimum": 0},
            "interval": {"type": "number", "minimum": 0},
            "partition": {"type": "number"},
            "offset": {"type": "number"},
        },
        "required": ["subscription_id", "values", "timestamp", "interval", "partition", "offset"],
        "additionalProperties": False,
    }
}
