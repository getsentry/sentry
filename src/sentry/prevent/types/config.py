_TRIGGER_SCHEMA = {
    "type": "object",
    "properties": {
        "on_command_phrase": {"type": "boolean"},
        "on_ready_for_review": {"type": "boolean"},
        "on_new_commit": {"type": "boolean"},
    },
    "required": ["on_command_phrase", "on_ready_for_review"],
    "additionalProperties": False,
}

_SENSITIVITY_ENUM = ["low", "medium", "high", "critical"]

_BUG_PREDICTION_SCHEMA = {
    "type": "object",
    "properties": {
        "enabled": {"type": "boolean"},
        "sensitivity": {
            "type": "string",
            "enum": _SENSITIVITY_ENUM,
        },
        "triggers": _TRIGGER_SCHEMA,
    },
    "required": ["enabled", "sensitivity", "triggers"],
    "additionalProperties": False,
}

_TEST_GENERATION_SCHEMA = {
    "type": "object",
    "properties": {
        "enabled": {"type": "boolean"},
        "triggers": _TRIGGER_SCHEMA,
    },
    "required": ["enabled", "triggers"],
    "additionalProperties": False,
}

_VANILLA_SCHEMA = {
    "type": "object",
    "properties": {
        "enabled": {"type": "boolean"},
        "sensitivity": {
            "type": "string",
            "enum": _SENSITIVITY_ENUM,
        },
        "triggers": _TRIGGER_SCHEMA,
    },
    "required": ["enabled", "sensitivity", "triggers"],
    "additionalProperties": False,
}

_ORG_DEFAULTS_SCHEMA = {
    "type": "object",
    "properties": {
        "bug_prediction": _BUG_PREDICTION_SCHEMA,
        "test_generation": _TEST_GENERATION_SCHEMA,
        "vanilla": _VANILLA_SCHEMA,
    },
    "required": ["bug_prediction", "test_generation", "vanilla"],
    "additionalProperties": False,
}

_REPO_OVERRIDE_SCHEMA = {
    "type": "object",
    "properties": {
        "bug_prediction": _BUG_PREDICTION_SCHEMA,
        "test_generation": _TEST_GENERATION_SCHEMA,
        "vanilla": _VANILLA_SCHEMA,
    },
    "required": ["bug_prediction", "test_generation", "vanilla"],
    "additionalProperties": False,
}

_REPO_OVERRIDES_SCHEMA = {
    "type": "object",
    "patternProperties": {
        ".*": _REPO_OVERRIDE_SCHEMA,
    },
    "additionalProperties": False,
}

ORG_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "org_defaults": _ORG_DEFAULTS_SCHEMA,
        "repo_overrides": _REPO_OVERRIDES_SCHEMA,
        "schema_version": {"type": "string", "enum": ["v1"]},
    },
    "required": ["org_defaults", "repo_overrides"],
    "additionalProperties": False,
}

PREVENT_AI_CONFIG_DEFAULT = {
    "schema_version": "v1",
    "default_org_config": {
        "org_defaults": {
            "bug_prediction": {
                "enabled": True,
                "sensitivity": "medium",
                "triggers": {
                    "on_command_phrase": True,
                    "on_ready_for_review": True,
                    "on_new_commit": False,
                },
            },
            "test_generation": {
                "enabled": True,
                "triggers": {
                    "on_command_phrase": True,
                    "on_ready_for_review": False,
                    "on_new_commit": False,
                },
            },
            "vanilla": {
                "enabled": True,
                "sensitivity": "medium",
                "triggers": {
                    "on_command_phrase": True,
                    "on_ready_for_review": False,
                    "on_new_commit": False,
                },
            },
        },
        "repo_overrides": {},
    },
    "organization": {},
}

PREVENT_AI_CONFIG_DEFAULT_V1 = {
    "schema_version": "v1",
    "default_org_config": {
        "org_defaults": {
            "bug_prediction": {
                "enabled": True,
                "sensitivity": "medium",
                "triggers": {
                    "on_command_phrase": True,
                    "on_ready_for_review": True,
                    # v1 default enables on_new_commit
                    "on_new_commit": True,
                },
            },
            "test_generation": {
                "enabled": True,
                "triggers": {
                    "on_command_phrase": True,
                    "on_ready_for_review": False,
                    "on_new_commit": False,
                },
            },
            "vanilla": {
                "enabled": True,
                "sensitivity": "medium",
                "triggers": {
                    "on_command_phrase": True,
                    "on_ready_for_review": False,
                    "on_new_commit": False,
                },
            },
        },
        "repo_overrides": {},
    },
    "organization": {},
}
