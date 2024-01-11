from unittest import mock

import pytest

from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.fingerprinting import (
    FINGERPRINTING_BASES,
    FingerprintingRules,
    InvalidFingerprintingConfig,
    _load_configs,
)
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.grouping import with_fingerprint_input, with_fingerprint_input_for_built_in

GROUPING_CONFIG = get_default_grouping_config_dict()


def test_basic_parsing(insta_snapshot):
    rules = FingerprintingRules.from_config_string(
        """
# This is a config
type:DatabaseUnavailable                        -> DatabaseUnavailable
function:assertion_failed module:foo            -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{ default }}
!path:**/foo/**                                 -> everything
!"path":**/foo/**                               -> everything
logger:sentry.*                                 -> logger-, {{ logger }}
message:"\\x\\xff"                              -> stuff
logger:sentry.*                                 -> logger-{{ logger }}, title="Message from {{ logger }}"
logger:sentry.*                                 -> logger-{{ logger }} title="Message from {{ logger }}"
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
                "attributes": {},
            },
            {"matchers": [["app", "true"]], "fingerprint": ["aha"], "attributes": {}},
            {"matchers": [["app", "true"]], "fingerprint": ["{{ default }}"], "attributes": {}},
            {"matchers": [["!path", "**/foo/**"]], "fingerprint": ["everything"], "attributes": {}},
            {"matchers": [["!path", "**/foo/**"]], "fingerprint": ["everything"], "attributes": {}},
            {
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {"matchers": [["message", "\\x\xff"]], "fingerprint": ["stuff"], "attributes": {}},
            {
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {"title": "Message from {{ logger }}"},
            },
            {
                "matchers": [["logger", "sentry.*"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {"title": "Message from {{ logger }}"},
            },
        ],
        "version": 1,
    }

    assert (
        FingerprintingRules._from_config_structure(
            rules._to_config_structure()
        )._to_config_structure()
        == rules._to_config_structure()
    )


def test_rule_export():
    rules = FingerprintingRules.from_config_string(
        """
logger:sentry.*                                 -> logger, {{ logger }}, title="Message from {{ logger }}"
"""
    )
    assert rules.rules[0].to_json() == {
        "attributes": {"title": "Message from {{ logger }}"},
        "fingerprint": ["logger", "{{ logger }}"],
        "matchers": [["logger", "sentry.*"]],
    }


def test_parsing_errors():
    with pytest.raises(InvalidFingerprintingConfig):
        FingerprintingRules.from_config_string("invalid.message:foo -> bar")


def test_automatic_argument_splitting():
    rules = FingerprintingRules.from_config_string(
        """
logger:test -> logger-{{ logger }}
logger:test -> logger-, {{ logger }}
logger:test2 -> logger-{{ logger }}-{{ level }}
logger:test2 -> logger-, {{ logger }}, -, {{ level }}
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "matchers": [["logger", "test"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "matchers": [["logger", "test"]],
                "fingerprint": ["logger-", "{{ logger }}"],
                "attributes": {},
            },
            {
                "matchers": [["logger", "test2"]],
                "fingerprint": ["logger-", "{{ logger }}", "-", "{{ level }}"],
                "attributes": {},
            },
            {
                "matchers": [["logger", "test2"]],
                "fingerprint": ["logger-", "{{ logger }}", "-", "{{ level }}"],
                "attributes": {},
            },
        ],
        "version": 1,
    }


def test_discover_field_parsing(insta_snapshot):
    rules = FingerprintingRules.from_config_string(
        """
# This is a config
error.type:DatabaseUnavailable                        -> DatabaseUnavailable
stack.function:assertion_failed stack.module:foo      -> AssertionFailed, foo
app:true                                        -> aha
app:true                                        -> {{ default }}
"""
    )
    assert rules._to_config_structure() == {
        "rules": [
            {
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
            },
            {
                "matchers": [["function", "assertion_failed"], ["module", "foo"]],
                "fingerprint": ["AssertionFailed", "foo"],
                "attributes": {},
            },
            {"matchers": [["app", "true"]], "fingerprint": ["aha"], "attributes": {}},
            {"matchers": [["app", "true"]], "fingerprint": ["{{ default }}"], "attributes": {}},
        ],
        "version": 1,
    }

    assert (
        FingerprintingRules._from_config_structure(
            rules._to_config_structure()
        )._to_config_structure()
        == rules._to_config_structure()
    )


@with_fingerprint_input("input")
def test_event_hash_variant(insta_snapshot, input):
    config, evt = input.create_event()

    def dump_variant(v):
        rv = v.as_dict()

        for key in "hash", "description", "config":
            rv.pop(key, None)

        if "component" in rv:
            for key in "id", "name", "values":
                rv["component"].pop(key, None)

        return rv

    insta_snapshot(
        {
            "config": config.to_json(),
            "fingerprint": evt.data["fingerprint"],
            "title": evt.data["title"],
            "variants": {
                k: dump_variant(v)
                for (k, v) in evt.get_grouping_variants(force_config=GROUPING_CONFIG).items()
            },
        }
    )


@django_db_all
@with_fingerprint_input_for_built_in("input")
def test_event_hash_variant_for_built_in(insta_snapshot, input):
    config, evt = input.create_event()

    def dump_variant(v):
        rv = v.as_dict()

        for key in "hash", "description", "config":
            rv.pop(key, None)

        if "component" in rv:
            for key in "id", "name", "values":
                rv["component"].pop(key, None)

        return rv

    insta_snapshot(
        {
            "config": config.to_json(),
            "fingerprint": evt.data["fingerprint"],
            "title": evt.data["title"],
            "variants": {
                k: dump_variant(v)
                for (k, v) in evt.get_grouping_variants(force_config=GROUPING_CONFIG).items()
            },
        }
    )


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
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
        ]
    }


def test_built_in_chunkload_rules(default_bases):
    rules = FingerprintingRules(rules=[], bases=default_bases)

    assert rules._to_config_structure() == {"rules": [], "version": 1}
    assert rules._to_config_structure(include_builtin=True) == {
        "rules": [
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
        ],
        "version": 1,
    }


def test_built_in_chunkload_rules_from_empty_config_string(default_bases):
    rules = FingerprintingRules.from_config_string("", bases=default_bases)

    assert rules._to_config_structure() == {"rules": [], "version": 1}
    assert rules._to_config_structure(include_builtin=True) == {
        "rules": [
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
        ],
        "version": 1,
    }


def test_built_in_chunkload_rules_from_config_string_with_custom(default_bases):
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
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["type", "ChunkLoadError"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
            {
                "matchers": [["sdk", "sentry.javascript.nextjs"], ["value", "ChunkLoadError*"]],
                "fingerprint": ["chunkloaderror"],
                "attributes": {},
            },
            {
                "matchers": [["type", "DatabaseUnavailable"]],
                "fingerprint": ["DatabaseUnavailable"],
                "attributes": {},
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
        },
    ]
