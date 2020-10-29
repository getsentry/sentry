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
                "properties": {
                    "data": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "minProperties": 1,
                            "additionalProperties": {"type": "number"},
                        },
                    }
                },
                "required": ["data"],
            },
            "timestamp": {"type": "string", "format": "date-time"},
        },
        "required": ["subscription_id", "values", "timestamp"],
        "additionalProperties": False,
    },
    2: {
        "type": "object",
        "properties": {
            "subscription_id": {"type": "string", "minLength": 1},
            "request": {"type": "object"},
            "result": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "minProperties": 1,
                            "additionalProperties": {"type": ["number", "null"]},
                        },
                    }
                },
                "required": ["data"],
            },
            "timestamp": {"type": "string", "format": "date-time"},
        },
        "required": ["subscription_id", "request", "result", "timestamp"],
        "additionalProperties": False,
    },
}
