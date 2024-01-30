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
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test

GROUPING_CONFIG = get_default_grouping_config_dict()


@pytest.fixture
def default_bases():
    return ["sentry.javascript.nextjs@2023-12-22"]


def test_default_bases(default_bases):
    assert FINGERPRINTING_BASES
    assert set(default_bases) == set(FINGERPRINTING_BASES.keys())
    assert {
        k: [r._to_config_structure() for r in rs] for k, rs in FINGERPRINTING_BASES.items()
    } == {
        "sentry.javascript.nextjs@2023-12-22": [
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
                "is_builtin": True,
            },
            {
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                "matchers": [
                    ["sdk", "sentry.javascript.nextjs"],
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
                    ["sdk", "sentry.javascript.nextjs"],
                    ["message", "Text content does not match server-rendered HTML."],
                ],
                "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
                "attributes": {},
                "is_builtin": True,
            },
        ],
        "version": 1,
    }


def test_load_configs_empty_doesnt_blow_up(tmp_path):
    with mock.patch("sentry.grouping.fingerprinting.CONFIGS_DIR", tmp_path):
        assert _load_configs() == {}


def test_load_configs_nx_path_doesnt_blow_up(tmp_path):
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
            "version": 1,
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
            "version": 1,
        },
        bases=[],
    )

    assert rules.rules[0].is_builtin == bool(is_builtin)


@region_silo_test
class BuiltInFingerprintingTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.chunkload_error_trace = {
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
        self.hydration_error_trace = {
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

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_chunkload_rules(self):
        """
        With flag enabled, the built-in rules for ChunkLoadError should be applied.
        """

        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)

        assert event.data["fingerprint"] == ["chunkloaderror"]
        assert event.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["chunkloaderror"],
            "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
            "is_builtin": True,
        }

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_chunkload_rules_variants(self):
        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)
        variants = {
            k: v.as_dict()
            for k, v in event.get_grouping_variants(force_config=GROUPING_CONFIG).items()
        }
        assert "built-in-fingerprint" in variants

        assert variants["built-in-fingerprint"] == {
            "hash": mock.ANY,  # ignore hash as it can change for unrelated reasons
            "type": "built-in-fingerprint",
            "description": "Sentry defined fingerprint",
            "values": ["chunkloaderror"],
            "client_values": ["my-route", "{{ default }}"],
            "matched_rule": 'sdk:"sentry.javascript.nextjs" type:"ChunkLoadError" -> "chunkloaderror"',
        }

    def test_built_in_chunkload_rules_disabled(self):
        """
        With flag disabled, the built-in rules for ChunkLoadError should be ignored.
        """
        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)
        assert event.data["fingerprint"] == ["my-route", "{{ default }}"]
        assert event.data.get("_fingerprint_info") is None

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_chunkload_rules_value_only(self):
        """
        ChunkLoadError rule based on value should apply even if error is not ChunkLoadError type.
        """
        self.chunkload_error_trace["exception"]["values"][0]["type"] = "chunky"  # type: ignore[index]

        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)
        assert event.data["fingerprint"] == ["chunkloaderror"]
        assert event.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["chunkloaderror"],
            "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
            "is_builtin": True,
        }

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_chunkload_rules_wrong_sdk(self):
        """
        Built-in ChunkLoadError rule should not apply if SDK is not sentry.javascript.nextjs.
        """
        self.chunkload_error_trace["sdk"]["name"] = "sentry.javascript.react"  # type: ignore[index]

        event = self._get_event_for_trace(stacktrace=self.chunkload_error_trace)
        assert event.data["fingerprint"] == ["my-route", "{{ default }}"]
        assert event.data.get("_fingerprint_info") is None

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_hydration_rules_same_transactions(self):
        """
        With the flag enabled, hydration errors with the same transaction should be grouped and
        the built-in rules for hydration errors should be applied.
        """

        event_message1 = self.store_event(data=self.hydration_error_trace, project_id=self.project)
        data_message2 = self.hydration_error_trace.copy()
        data_message2[
            "message"
        ] = "Hydration failed because the initial UI does not match what was rendered on the server."
        event_message2 = self.store_event(data=data_message2, project_id=self.project)

        assert event_message1.data.data["fingerprint"] == ["hydrationerror", "{{tags.transaction}}"]
        assert event_message1.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["sdk", "sentry.javascript.nextjs"],
                ["message", self.hydration_error_trace["message"]],
            ],
            "is_builtin": True,
        }
        assert event_message2.data.data["fingerprint"] == ["hydrationerror", "{{tags.transaction}}"]
        assert event_message2.data.data["_fingerprint_info"]["matched_rule"] == {
            "attributes": {},
            "fingerprint": ["hydrationerror", "{{tags.transaction}}"],
            "matchers": [
                ["sdk", "sentry.javascript.nextjs"],
                ["message", data_message2["message"]],
            ],
            "is_builtin": True,
        }

        assert event_message1.group == event_message2.group

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_hydration_rules_different_transactions(self):
        """
        With the flag enabled, hydration errors with different transactions should not be grouped and
        the built-in rules for hydration errors should be applied.
        """

        event_transaction_slash = self.store_event(
            data=self.hydration_error_trace, project_id=self.project
        )
        data_transaction_text = self.hydration_error_trace.copy()
        data_transaction_text["tags"]["transaction"] = "/text/"  # type: ignore[index]
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
                ["sdk", "sentry.javascript.nextjs"],
                ["message", self.hydration_error_trace["message"]],
            ],
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
                ["sdk", "sentry.javascript.nextjs"],
                ["message", self.hydration_error_trace["message"]],
            ],
            "is_builtin": True,
        }

        assert event_transaction_slash.group != event_transaction_text.group

    def test_built_in_hydration_rules_disabled(self):
        """
        With flag disabled, the built-in rules for hydration errors should be ignored.
        """
        event = self.store_event(data=self.hydration_error_trace, project_id=self.project)
        assert event.data.data["fingerprint"] == ["my-route", "{{ default }}"]
        assert event.data.data.get("_fingerprint_info") is None

    @with_feature("organizations:grouping-built-in-fingerprint-rules")
    def test_built_in_hydration_rules_no_transactions(self):
        """
        With the flag enabled, hydration errors with no transactions should work as expected.
        """

        data_transaction_no_tx = self.hydration_error_trace
        del data_transaction_no_tx["tags"]["transaction"]  # type: ignore[attr-defined]
        event_transaction_no_tx = self.store_event(
            data=data_transaction_no_tx, project_id=self.project
        )
        variants = {
            k: v.as_dict()
            for k, v in event_transaction_no_tx.get_grouping_variants(
                force_config=GROUPING_CONFIG
            ).items()
        }

        assert variants["built-in-fingerprint"] == {
            "hash": mock.ANY,  # ignore hash as it can change for unrelated reasons
            "type": "built-in-fingerprint",
            "description": "Sentry defined fingerprint",
            "values": ["hydrationerror", "<no-value-for-tag-transaction>"],
            "client_values": ["my-route", "{{ default }}"],
            "matched_rule": 'sdk:"sentry.javascript.nextjs" message:"Text content does not match server-rendered HTML." -> "hydrationerror{{tags.transaction}}"',
        }
