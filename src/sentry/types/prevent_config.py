PREVENT_AI_CONFIG_GITHUB_DEFAULT = {
    "schema_version": "v1",
    "org_defaults": {
        "bug_prediction": {
            "enabled": False,
            "sensitivity": "medium",
            "triggers": {
                "on_command_phrase": True,
                "on_ready_for_review": True,
            },
        },
        "test_generation": {
            "enabled": False,
            "triggers": {
                "on_command_phrase": True,
                "on_ready_for_review": False,
            },
        },
        "vanilla": {
            "enabled": False,
            "sensitivity": "medium",
            "triggers": {
                "on_command_phrase": True,
                "on_ready_for_review": False,
            },
        },
    },
    "repo_overrides": {},
}


PREVENT_AI_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "schema_version": {"type": "string", "enum": ["v1"]},
        "org_defaults": {
            "type": "object",
            "properties": {
                "bug_prediction": {
                    "type": "object",
                    "properties": {
                        "enabled": {"type": "boolean"},
                        "sensitivity": {
                            "type": "string",
                            "enum": ["low", "medium", "high", "critical"],
                        },
                        "triggers": {
                            "type": "object",
                            "properties": {
                                "on_command_phrase": {"type": "boolean"},
                                "on_ready_for_review": {"type": "boolean"},
                            },
                            "required": ["on_command_phrase", "on_ready_for_review"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["enabled", "sensitivity", "triggers"],
                    "additionalProperties": False,
                },
                "test_generation": {
                    "type": "object",
                    "properties": {
                        "enabled": {"type": "boolean"},
                        "triggers": {
                            "type": "object",
                            "properties": {
                                "on_command_phrase": {"type": "boolean"},
                                "on_ready_for_review": {"type": "boolean"},
                            },
                            "required": ["on_command_phrase", "on_ready_for_review"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["enabled", "triggers"],
                    "additionalProperties": False,
                },
                "vanilla": {
                    "type": "object",
                    "properties": {
                        "enabled": {"type": "boolean"},
                        "sensitivity": {
                            "type": "string",
                            "enum": ["low", "medium", "high", "critical"],
                        },
                        "triggers": {
                            "type": "object",
                            "properties": {
                                "on_command_phrase": {"type": "boolean"},
                                "on_ready_for_review": {"type": "boolean"},
                            },
                            "required": ["on_command_phrase", "on_ready_for_review"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["enabled", "sensitivity", "triggers"],
                    "additionalProperties": False,
                },
            },
            "required": ["bug_prediction", "test_generation", "vanilla"],
            "additionalProperties": False,
        },
        "repo_overrides": {
            "type": "object",
            "patternProperties": {
                ".*": {
                    "type": "object",
                    "properties": {
                        "bug_prediction": {
                            "type": "object",
                            "properties": {
                                "enabled": {"type": "boolean"},
                                "sensitivity": {
                                    "type": "string",
                                    "enum": ["low", "medium", "high", "critical"],
                                },
                                "triggers": {
                                    "type": "object",
                                    "properties": {
                                        "on_command_phrase": {"type": "boolean"},
                                        "on_ready_for_review": {"type": "boolean"},
                                    },
                                    "required": ["on_command_phrase", "on_ready_for_review"],
                                    "additionalProperties": False,
                                },
                            },
                            "required": ["enabled", "sensitivity", "triggers"],
                            "additionalProperties": False,
                        },
                        "test_generation": {
                            "type": "object",
                            "properties": {
                                "enabled": {"type": "boolean"},
                                "triggers": {
                                    "type": "object",
                                    "properties": {
                                        "on_command_phrase": {"type": "boolean"},
                                        "on_ready_for_review": {"type": "boolean"},
                                    },
                                    "required": ["on_command_phrase", "on_ready_for_review"],
                                    "additionalProperties": False,
                                },
                            },
                            "required": ["enabled", "triggers"],
                            "additionalProperties": False,
                        },
                        "vanilla": {
                            "type": "object",
                            "properties": {
                                "enabled": {"type": "boolean"},
                                "sensitivity": {
                                    "type": "string",
                                    "enum": ["low", "medium", "high", "critical"],
                                },
                                "triggers": {
                                    "type": "object",
                                    "properties": {
                                        "on_command_phrase": {"type": "boolean"},
                                        "on_ready_for_review": {"type": "boolean"},
                                    },
                                    "required": ["on_command_phrase", "on_ready_for_review"],
                                    "additionalProperties": False,
                                },
                            },
                            "required": ["enabled", "sensitivity", "triggers"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["bug_prediction", "test_generation", "vanilla"],
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False,
        },
    },
    "required": ["schema_version", "org_defaults", "repo_overrides"],
    "additionalProperties": False,
}
