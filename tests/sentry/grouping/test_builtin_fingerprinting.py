from __future__ import annotations

from typing import Any
from unittest import mock

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager, get_event_type, materialize_metadata
from sentry.grouping.api import (
    apply_server_fingerprinting,
    get_default_grouping_config_dict,
    get_fingerprinting_config_for_project,
)
from sentry.grouping.fingerprinting import (
    FINGERPRINTING_BASES,
    BuiltInFingerprintingRules,
    FingerprintingRules,
    _load_configs,
)
from sentry.testutils.cases import TestCase

GROUPING_CONFIG = get_default_grouping_config_dict()


@pytest.fixture
def default_bases():
    return ["javascript@2024-02-02"]


def test_default_bases(default_bases):
    assert FINGERPRINTING_BASES
    assert set(default_bases) == set(FINGERPRINTING_BASES.keys())
    assert {
        fingerprinting_base: [rule._to_config_structure() for rule in ruleset]
        for fingerprinting_base, ruleset in FINGERPRINTING_BASES.items()
    } == {
        "javascript@2024-02-02": [
            {
                "text": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" value:"ChunkLoadError*" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Hydration failed because the initial UI does not match what was rendered on the server." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "Hydration failed because the initial UI does not match what was rendered on the server.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating this Suspense boundary. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating this Suspense boundary. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    ["message", "Text content does not match server-rendered HTML."],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
        ]
    }


def test_built_in_nextjs_rules_base(default_bases):
    rules = FingerprintingRules(rules=[], bases=default_bases)

    assert rules._to_config_structure() == {"rules": [], "version": 1}
    assert rules._to_config_structure(include_builtin=True) == {
        "rules": [
            {
                "text": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" value:"ChunkLoadError*" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Hydration failed because the initial UI does not match what was rendered on the server." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "Hydration failed because the initial UI does not match what was rendered on the server.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating this Suspense boundary. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating this Suspense boundary. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    ["message", "Text content does not match server-rendered HTML."],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
        ],
        "version": 1,
    }


def test_built_in_nextjs_rules_from_empty_config_string(default_bases):
    rules = FingerprintingRules.from_config_string("", bases=default_bases)

    assert rules._to_config_structure() == {"rules": [], "version": 1}
    assert rules._to_config_structure(include_builtin=True) == {
        "rules": [
            {
                "text": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" value:"ChunkLoadError*" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Hydration failed because the initial UI does not match what was rendered on the server." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "Hydration failed because the initial UI does not match what was rendered on the server.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating this Suspense boundary. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating this Suspense boundary. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    ["message", "Text content does not match server-rendered HTML."],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
        ],
        "version": 1,
    }


def test_built_in_nextjs_rules_from_config_string_with_custom(default_bases):
    rules = FingerprintingRules.from_config_string(
        "error.type:DatabaseUnavailable -> DatabaseUnavailable",
        bases=default_bases,
    )
    assert rules._to_config_structure(include_builtin=False) == {
        "rules": [
            {
                "text": 'type:"DatabaseUnavailable" -> "DatabaseUnavailable"',
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
        ],
        "version": 1,
    }
    assert rules._to_config_structure(include_builtin=True) == {
        "rules": [
            {
                "text": 'type:"DatabaseUnavailable" -> "DatabaseUnavailable"',
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "text": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" value:"ChunkLoadError*" -> "chunkloaderror"',
                "matchers": [["family", "javascript"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"Hydration failed because the initial UI does not match what was rendered on the server." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "Hydration failed because the initial UI does not match what was rendered on the server.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating this Suspense boundary. Switched to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating this Suspense boundary. Switched to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "text": 'family:"javascript" tags.transaction:"*" message:"There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering." -> "hydrationerror{{tags.transaction}}"',
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    [
                        "message",
                        "There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.",
                    ],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [
                    ["family", "javascript"],
                    ["tags.transaction", "*"],
                    ["message", "Text content does not match server-rendered HTML."],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
                "attributes": {},
                "is_builtin": True,
            },
        ],
        "version": 1,
    }


def test_load_configs_empty_doesnt_blow_up(tmp_path):
    with mock.patch("sentry.grouping.fingerprinting.CONFIGS_DIR", tmp_path):
        assert _load_configs() == {}


def test_load_configs_non_existent_path_doesnt_blow_up(tmp_path):
    tmp_path.rmdir()
    with mock.patch("sentry.grouping.fingerprinting.CONFIGS_DIR", tmp_path):
        assert _load_configs() == {}


def test_load_configs_borked_file_doesnt_blow_up(tmp_path):
    base = "foo@2077-01-02"
    rule_dir = tmp_path / base
    rule_dir.mkdir()
    (rule_dir / "foo.txt").write_text("a malformed rule file that ought to be ignored")
    (rule_dir / "bar.txt").write_text("type:DatabaseUnavailable -> DatabaseUnavailable")
    (rule_dir / "baz.txt").write_text("inaccessible file")
    (rule_dir / "baz.txt").chmod(0o111)

    with mock.patch("sentry.grouping.fingerprinting.CONFIGS_DIR", tmp_path):
        configs = _load_configs()

    assert base in configs
    rules = configs[base]

    assert [r._to_config_structure() for r in rules] == [
        {
            "text": 'type:"DatabaseUnavailable" -> "DatabaseUnavailable"',
            "matchers": [["type", "DatabaseUnavailable"]],
            "fingerprint": ["DatabaseUnavailable"],
            "attributes": {},
            "is_builtin": True,
        },
    ]


@pytest.mark.parametrize("is_builtin", [True, False, None])
def test_builtinfingerprinting_rules_from_config_structure_overrides_is_builtin(is_builtin):
    rules = BuiltInFingerprintingRules._from_config_structure(
        {
            "rules": [
                {
                    "matchers": [["type", "DatabaseUnavailable"]],
                    "fingerprint": ["DatabaseUnavailable"],
                    "attributes": {},
                    "is_builtin": is_builtin,
                },
            ],
        },
        bases=[],
    )

    assert rules.rules[0].is_builtin is True


@pytest.mark.parametrize("is_builtin", [True, False, None])
def test_fingerprinting_rules_from_config_structure_preserves_is_builtin(is_builtin):
    rules = FingerprintingRules._from_config_structure(
        {
            "rules": [
                {
                    "matchers": [["type", "DatabaseUnavailable"]],
                    "fingerprint": ["DatabaseUnavailable"],
                    "attributes": {},
                    "is_builtin": is_builtin,
                },
            ],
        },
        bases=[],
    )

    assert rules.rules[0].is_builtin == bool(is_builtin)


class BuiltInFingerprintingTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.chunkload_error_trace: dict[str, Any] = {
            "fingerprint": ["my-route", "{{ default }}"],
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "main",
                                    "abs_path": "foo/bar.tsx",
                                    "module": "foo.bar",
                                    "filename": "bar.tsx",
                                    "lineno": 13,
                                    "in_app": False,
                                }
                            ]
                        },
                        "type": "ChunkLoadError",
                        "value": "ChunkLoadError: something something...",
                    }
                ]
            },
            "platform": "javascript",
            "sdk": {"name": "sentry.javascript.nextjs", "version": "1.2.3"},
        }
        self.hydration_error_trace: dict[str, Any] = {
            "fingerprint": ["my-route", "{{ default }}"],
            "message": "Text content does not match server-rendered HTML.",
            "platform": "javascript",
            "sdk": {"name": "sentry.javascript.nextjs", "version": "1.2.3"},
            "tags": {"transaction": "/"},
        }

    def _get_event_for_trace(self, stacktrace):
        mgr = EventManager(data=stacktrace, grouping_config=GROUPING_CONFIG)
        mgr.normalize()
        data = mgr.get_data()
        data.setdefault("fingerprint", ["{{ default }}"])
        fingerprinting_config = get_fingerprinting_config_for_project(project=self.project)
        apply_server_fingerprinting(data, fingerprinting_config)
        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        data.update(materialize_metadata(data, event_type, event_metadata))

        return eventstore.backend.create_event(data=data)

    def test_built_in_chunkload_rules(self):
        """
        With flag enabled, the built-in rules for ChunkLoadError should be applied.
        """

        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)

        assert event.data["fingerprint"] == ["chunkloaderror"]
        assert event.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["chunkloaderror"],
            "matchers": [["family", "javascript"], ["type", "ChunkLoadError"]],
            "text": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
            "is_builtin": True,
        }

    def test_built_in_chunkload_rules_variants(self):
        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)
        variants = {
            variant_name: variant.as_dict()
            for variant_name, variant in event.get_grouping_variants(
                force_config=GROUPING_CONFIG
            ).items()
        }
        assert "built_in_fingerprint" in variants

        assert variants["built_in_fingerprint"] == {
            "hash": mock.ANY,  # ignore hash as it can change for unrelated reasons
            "type": "built_in_fingerprint",
            "description": "Sentry defined fingerprint",
            "values": ["chunkloaderror"],
            "client_values": ["my-route", "{{ default }}"],
            "matched_rule": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
        }

    def test_built_in_chunkload_rules_value_only(self):
        """
        ChunkLoadError rule based on value should apply even if error is not ChunkLoadError type.
        """
        self.chunkload_error_trace["exception"]["values"][0]["type"] = "chunky"

        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)
        assert event.data["fingerprint"] == ["chunkloaderror"]
        assert event.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["chunkloaderror"],
            "matchers": [["family", "javascript"], ["value", "ChunkLoadError*"]],
            "text": 'family:"javascript" value:"ChunkLoadError*" -> "chunkloaderror"',
            "is_builtin": True,
        }

    def test_built_in_chunkload_rules_wrong_sdk(self):
        """
        Built-in ChunkLoadError rule should also apply regardless of the SDK value.
        """
        self.chunkload_error_trace["sdk"]["name"] = "not.a.real.SDK"

        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)

        assert event.data["fingerprint"] == ["chunkloaderror"]
        assert event.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["chunkloaderror"],
            "matchers": [["family", "javascript"], ["type", "ChunkLoadError"]],
            "text": 'family:"javascript" type:"ChunkLoadError" -> "chunkloaderror"',
            "is_builtin": True,
        }

    def test_built_in_hydration_rules_same_transactions(self):
        """
        With the flag enabled, hydration errors with the same transaction should be grouped and
        the built-in rules for hydration errors should be applied.
        """

        event_message1 = self.store_event(data=self.hydration_error_trace, project_id=self.project)
        data_message2 = self.hydration_error_trace.copy()
        data_message2["message"] = (
            "Hydration failed because the initial UI does not match what was rendered on the server."
        )
        event_message2 = self.store_event(data=data_message2, project_id=self.project)

        assert event_message1.data.data["fingerprint"] == ["hydrationerror", "{{tags.transaction}}"]
        assert event_message1.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["family", "javascript"],
                ["tags.transaction", "*"],
                ["message", self.hydration_error_trace["message"]],
            ],
            "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
            "is_builtin": True,
        }
        assert event_message2.data.data["fingerprint"] == ["hydrationerror", "{{tags.transaction}}"]
        assert event_message2.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["family", "javascript"],
                ["tags.transaction", "*"],
                ["message", data_message2["message"]],
            ],
            "text": 'family:"javascript" tags.transaction:"*" message:"Hydration failed because the initial UI does not match what was rendered on the server." -> "hydrationerror{{tags.transaction}}"',
            "is_builtin": True,
        }

        assert event_message1.group == event_message2.group

    def test_built_in_hydration_rules_different_transactions(self):
        """
        With the flag enabled, hydration errors with different transactions should not be grouped and
        the built-in rules for hydration errors should be applied.
        """

        event_transaction_slash = self.store_event(
            data=self.hydration_error_trace, project_id=self.project
        )
        data_transaction_text = self.hydration_error_trace.copy()
        data_transaction_text["tags"]["transaction"] = "/text/"
        event_transaction_text = self.store_event(
            data=data_transaction_text, project_id=self.project
        )

        assert event_transaction_slash.data.data["fingerprint"] == [
            "hydrationerror",
            "{{tags.transaction}}",
        ]
        assert event_transaction_slash.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["family", "javascript"],
                ["tags.transaction", "*"],
                ["message", self.hydration_error_trace["message"]],
            ],
            "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
            "is_builtin": True,
        }
        assert event_transaction_text.data.data["fingerprint"] == [
            "hydrationerror",
            "{{tags.transaction}}",
        ]
        assert event_transaction_text.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["family", "javascript"],
                ["tags.transaction", "*"],
                ["message", self.hydration_error_trace["message"]],
            ],
            "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
            "is_builtin": True,
        }

        assert event_transaction_slash.group != event_transaction_text.group

    def test_built_in_hydration_rules_no_transactions(self):
        """
        With the flag enabled, for hydration errors with no transactions
        the built-in HydrationError rules should NOT be applied.
        """

        data_transaction_no_tx = self.hydration_error_trace
        del data_transaction_no_tx["tags"]["transaction"]
        event_transaction_no_tx = self.store_event(
            data=data_transaction_no_tx, project_id=self.project
        )
        variants = {
            variant_name: variant.as_dict()
            for variant_name, variant in event_transaction_no_tx.get_grouping_variants(
                force_config=GROUPING_CONFIG
            ).items()
        }

        assert "built_in_fingerprint" not in variants
        assert event_transaction_no_tx.data["fingerprint"] == ["my-route", "{{ default }}"]

    def test_hydration_rule_w_family_matcher(self):
        """
        Testing if rules are applied correctly with a family matcher
        """

        mgr = EventManager(data=self.hydration_error_trace, grouping_config=GROUPING_CONFIG)
        mgr.normalize()
        data = mgr.get_data()
        data.setdefault("fingerprint", ["{{ default }}"])
        fingerprinting_config = FingerprintingRules.from_config_string(
            'family:javascript tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> hydrationerror, {{tags.transaction}}'
        )
        apply_server_fingerprinting(data, fingerprinting_config)
        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        data.update(materialize_metadata(data, event_type, event_metadata))

        event = eventstore.backend.create_event(data=data)

        assert event.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["family", "javascript"],
                ["tags.transaction", "*"],
                ["message", self.hydration_error_trace["message"]],
            ],
            "text": 'family:"javascript" tags.transaction:"*" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
        }
