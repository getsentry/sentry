from typing import Any, Mapping

EVENT_PAYLOAD_VERSIONS: Mapping[int, Mapping[str, Any]] = {
    0: {
        "type": "object",
        "properties": {
            "event_id": {"type": "string", "minLength": 1},
            "project_id": {"type": "string", "minLength": 1},
            "platform": {"type": "string", "minLength": 1},
            "tags": {
                "type": "object",
            },  # TODO
            "message_timestamp": {"type": "string", "format": "date-time"},
            "timestamp": {"type": "string", "format": "date-time"},
            # "result": {
            #     "type": "object",
            #     "properties": {
            #         "data": {
            #             "type": "array",
            #             "minItems": 1,
            #             "items": {
            #                 "type": "object",
            #                 "minProperties": 1,
            #                 "additionalProperties": {"type": ["number", "null"]},
            #             },
            #         }
            #     },
            #     "required": ["data"],
            # },
            # "trace_id": {"type": "string", "minLength": 1},
            # "transaction": {"type": "string", "minLength": 1},
            # # "server_name": {"type": "string", "minLength": 1},
            # "release": {"type": "string", "minLength": 1},
            # "dist": {"type": "string", "minLength": 1},
            # "environment": {"type": "string", "minLength": 1},
            # "user": {"type": "string", "minLength": 1},
            # "sdk": {"type": "string", "minLength": 1},
            # "contexts": {"type": "string", "minLength": 1},
            # "request": {"type": "string", "minLength": 1},
            # "modules": {"type": "string", "minLength": 1},
            # "extra": {"type": "string", "minLength": 1},
            # "message": {"type": "string", "minLength": 1},
            # "breadcrumbs": {"type": "string", "minLength": 1},
        },
        "required": ["event_id", "project_id", "title", "platform", "tags"],
        "additionalProperties": False,
    },
}
