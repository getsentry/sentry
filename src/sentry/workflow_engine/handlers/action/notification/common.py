from sentry.notifications.models.notificationaction import ActionTarget

# TODO(iamrajjoshi): This should be removed once I define the config schemas for each action type
GENERIC_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for Notification Actions",
    "type": "object",
    "properties": {
        "target_identifier": {
            "type": ["string", "null"],
        },
        "target_display": {
            "type": ["string", "null"],
        },
        "target_type": {
            "type": ["integer", "null"],
            "enum": [*ActionTarget] + [None],
        },
    },
}

MESSAGING_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for a Messaging Action",
    "type": "object",
    "properties": {
        "target_identifier": {"type": ["string"]},
        "target_display": {"type": ["string"]},
        "target_type": {
            "type": ["integer"],
            "enum": [ActionTarget.SPECIFIC.value],
        },
    },
    "required": ["target_identifier", "target_display", "target_type"],
    "additionalProperties": False,
}

TAGS_SCHEMA = {
    "type": "string",
    "description": "Tags to add to the message",
}

NOTES_SCHEMA = {
    "type": "string",
    "description": "Notes to add to the message",
}


ONCALL_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for a on-call Action",
    "type": "object",
    "properties": {
        "target_identifier": {"type": ["string"]},
        "target_display": {"type": ["string", "null"]},
        "target_type": {
            "type": ["integer"],
            "enum": [ActionTarget.SPECIFIC.value],
        },
    },
    "required": ["target_identifier", "target_type"],
    "additionalProperties": False,
}

EMAIL_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for an email Action",
    "type": "object",
    "properties": {
        "target_identifier": {"type": ["string", "null"]},
        "target_display": {"type": ["null"]},
        "target_type": {
            "type": ["integer"],
            "enum": [*ActionTarget],
        },
    },
    "required": ["target_type"],
    "additionalProperties": False,
}

EMAIL_ACTION_DATA_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "fallthroughType": {
            "type": "string",
            "description": "The fallthrough type for issue owners email notifications",
        },
    },
    "additionalProperties": False,
}
