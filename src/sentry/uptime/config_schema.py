from typing import int
CHECK_CONFIG_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "uptime_config",
    "$ref": "#/definitions/CheckConfig",
    "definitions": {
        "CheckInterval": {
            "title": "check_interval",
            "description": "The interval between each check run in seconds.",
            "type": "number",
            "enum": [60, 300, 600, 1200, 1800, 3600],
        },
        "RequestHeader": {
            "title": "request_header",
            "description": "An individual header, consisting of a name and value as a tuple.",
            "type": "array",
            "prefixItems": [
                {"title": "header_name", "type": "string"},
                {"title": "header_value", "type": "string"},
            ],
        },
        "RegionScheduleMode": {
            "title": "region_schedule_mode",
            "description": "Defines how we'll schedule checks based on other active regions.",
            "type": "string",
            "enum": ["round_robin"],
        },
        "CheckConfig": {
            "title": "check_config",
            "description": "A message containing the configuration for a check to scheduled and executed by the uptime-checker.",
            "type": "object",
            "additionalProperties": True,
            "properties": {
                "subscription_id": {
                    "description": "UUID of the subscription that this check config represents.",
                    "type": "string",
                },
                "interval_seconds": {"$ref": "#/definitions/CheckInterval"},
                "timeout_ms": {
                    "description": "The total time we will allow to make the request in milliseconds.",
                    "type": "number",
                },
                "url": {"description": "The actual HTTP URL to check.", "type": "string"},
                "request_method": {
                    "description": "The HTTP method to use for the request.",
                    "type": "string",
                    "enum": ["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"],
                },
                "request_headers": {
                    "description": "Additional HTTP headers to send with the request",
                    "type": "array",
                    "items": {"$ref": "#/definitions/RequestHeader"},
                },
                "request_body": {
                    "description": "Additional HTTP headers to send with the request",
                    "type": "string",
                },
                "trace_sampling": {
                    "description": "Whether to allow for sampled trace spans for the request.",
                    "type": "boolean",
                },
                "active_regions": {
                    "description": "A list of region slugs the uptime check is configured to run in.",
                    "type": "array",
                    "items": {"type": "string"},
                },
                "region_schedule_mode": {"$ref": "#/definitions/RegionScheduleMode"},
            },
            "required": ["subscription_id", "interval_seconds", "timeout_ms", "url"],
        },
    },
}
"""
The json-schema for the uptime config object provided to the uptime-checker via redis.
"""
