PREVENT_AI_CONFIG_GITHUB_DEFAULT = {
    "org_defaults": {
        "on_command_phrase": {"bug_prediction": True, "vanilla": True},
        "on_ready_for_review": {"bug_prediction": True, "vanilla": False},
    },
    "repo_overrides": {},
}


PREVENT_AI_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "org_defaults": {
            "type": "object",
            "properties": {
                "on_command_phrase": {
                    "type": "object",
                    "properties": {
                        "bug_prediction": {"type": "boolean"},
                        "vanilla": {"type": "boolean"},
                    },
                    "required": ["bug_prediction", "vanilla"],
                    "additionalProperties": False,
                },
                "on_ready_for_review": {
                    "type": "object",
                    "properties": {
                        "bug_prediction": {"type": "boolean"},
                        "vanilla": {"type": "boolean"},
                    },
                    "required": ["bug_prediction", "vanilla"],
                    "additionalProperties": False,
                },
            },
            "required": ["on_command_phrase", "on_ready_for_review"],
            "additionalProperties": False,
        },
        "repo_overrides": {
            "type": "object",
            "patternProperties": {
                ".*": {
                    "type": "object",
                    "properties": {
                        "on_command_phrase": {
                            "type": "object",
                            "properties": {
                                "bug_prediction": {"type": "boolean"},
                                "vanilla": {"type": "boolean"},
                            },
                            "required": ["bug_prediction", "vanilla"],
                            "additionalProperties": False,
                        },
                        "on_ready_for_review": {
                            "type": "object",
                            "properties": {
                                "bug_prediction": {"type": "boolean"},
                                "vanilla": {"type": "boolean"},
                            },
                            "required": ["bug_prediction", "vanilla"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["on_command_phrase", "on_ready_for_review"],
                    "additionalProperties": False,
                }
            },
            "additionalProperties": False,
        },
    },
    "required": ["org_defaults", "repo_overrides"],
    "additionalProperties": False,
}
