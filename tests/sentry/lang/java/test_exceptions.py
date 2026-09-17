import re
from typing import Any

from sentry.lang.java.exceptions import Exceptions


def build_event(exceptions_values):
    return {"exception": {"values": exceptions_values}}


def test_get_processable_exceptions_filters_by_type() -> None:
    data = build_event(
        [
            {"type": "RuntimeException", "module": "java.lang", "value": "boom"},
            {"type": "IllegalStateException", "value": "oops"},
            # Root-package obfuscated exception (R8 aggressive mode) — no module.
            {"type": "kj", "value": "compose boom"},
            {"module": "kotlin", "value": "meh"},
            {"value": "just text"},
        ]
    )

    excs = Exceptions(data)
    processable = excs.get_processable_exceptions()

    assert len(processable) == 3
    assert processable[0]["type"] == "RuntimeException"
    assert processable[0]["module"] == "java.lang"
    assert processable[1]["type"] == "IllegalStateException"
    assert processable[2]["type"] == "kj"


def test_value_class_names_matches_fqcn_inner_and_quoted_multiple_values() -> None:
    data = build_event(
        [
            {
                "value": "Serializer for subclass 'o' is not found in the polymorphic scope of \"j4\""
            },
            {"value": "Caused by com.example.myapp.MainActivity"},
            {"value": "Happened inside a.b$c$1"},
            {"value": "Cannot cast com.mycompany.myclass to Tf.k"},
        ]
    )

    excs = Exceptions(data)
    class_names = excs.get_exception_class_names()

    # Expect quoted single-segment and FQCN and inner class patterns across values
    assert "o" in class_names
    assert "j4" in class_names
    assert "com.example.myapp.MainActivity" in class_names
    assert "a.b$c$1" in class_names
    assert "com.mycompany.myclass" in class_names
    assert "Tf.k" in class_names


def test_deobfuscate_and_save_deobfuscates_types_and_values_multiple_values() -> None:
    # First exception is processable by type/module mapping
    exc1 = {"type": "g$a", "module": "org.a.b", "value": "something with org.a.b.g$a"}
    # Next exceptions only have value matches, spread across multiple exceptions
    exc2 = {"value": "Serializer for subclass 'o' is not found in the polymorphic scope of \"j4\""}
    exc3 = {"value": "Caused by com.example.myapp.MainActivity in a.b$c$1"}
    data = build_event([exc1, exc2, exc3])

    excs = Exceptions(data)

    # Mapped exceptions (one per processable exception with type/module)
    mapped_exceptions = [
        {"type": "Util$ClassContextSecurityManager", "module": "org.slf4j.helpers"}
    ]

    # Class name mapping for replacements in values; note quoted keys
    classes = {
        "o": "org.example.ObfO",
        "j4": "org.example.ObfJ4",
        "com.example.myapp.MainActivity": "io.sample.MainActivity",
        "a.b$c$1": "alpha.beta.C$1",
        # also test that unmapped occurrences (like org.a.b.g$a in value) are ignored safely
    }

    excs.deobfuscate_and_save(classes, mapped_exceptions)

    # exc1 module/type updated and raw_* preserved
    assert exc1["raw_module"] == "org.a.b"
    assert exc1["raw_type"] == "g$a"
    assert exc1["module"] == "org.slf4j.helpers"
    assert exc1["type"] == "Util$ClassContextSecurityManager"

    # exc2 value updated and raw_value preserved
    assert "org.example.ObfO" in exc2["value"]
    assert "org.example.ObfJ4" in exc2["value"]
    assert exc2["raw_value"].startswith("Serializer for subclass 'o'")

    # exc3 value updated and raw_value preserved
    assert "io.sample.MainActivity" in exc3["value"]
    assert "alpha.beta.C$1" in exc3["value"]
    assert exc3["raw_value"].startswith("Caused by com.example.myapp.MainActivity")


def test_deobfuscate_and_save_root_package_exception() -> None:
    # R8 aggressive mode produces root-package classes with no module;
    # raw_module must be preserved as None when originally absent.
    exc: dict[str, Any] = {"type": "kj", "value": "compose boom"}
    data = build_event([exc])

    excs = Exceptions(data)

    mapped_exceptions = [
        {
            "type": "DiagnosticComposeException",
            "module": "androidx.compose.runtime.tooling",
        }
    ]

    excs.deobfuscate_and_save(None, mapped_exceptions)

    assert exc["raw_type"] == "kj"
    assert exc["raw_module"] is None
    assert exc["type"] == "DiagnosticComposeException"
    assert exc["module"] == "androidx.compose.runtime.tooling"


def test_deobfuscate_value_replaces_longest_tokens_first() -> None:
    # Overlapping tokens: a.b$c$1 (longer) and a.b$c (shorter)
    exc = {"value": "Found both inner a.b$c$1 and outer a.b$c in text"}
    data = build_event([exc])

    excs = Exceptions(data)

    classes = {
        "a.b$c$1": "alpha.beta.C$1",
        "a.b$c": "alpha.beta.C",
    }

    excs.deobfuscate_and_save(classes, mapped_exceptions=[])

    # The longer token must be replaced without being broken by the shorter one
    assert exc["value"].count("alpha.beta.C$1") == 1
    # Count standalone occurrences of alpha.beta.C (not those that are part of alpha.beta.C$1)
    standalone = re.findall(r"(?<![\w$])alpha\.beta\.C(?![\w$])", exc["value"])
    assert len(standalone) == 1
    assert "a.b$c$1" not in exc["value"]
    assert "a.b$c" not in exc["value"]
    assert exc["raw_value"].startswith("Found both inner a.b$c$1")


def test_deobfuscate_value_preserves_quotes_in_replacements() -> None:
    exc = {"value": "Got 'o' and \"j4\" in message"}
    data = build_event([exc])

    excs = Exceptions(data)

    classes = {
        "o": "org.example.ObfO",
        "j4": "org.example.ObfJ4",
    }

    excs.deobfuscate_and_save(classes, mapped_exceptions=[])

    assert "'org.example.ObfO'" in exc["value"]
    assert '"org.example.ObfJ4"' in exc["value"]
    assert exc["raw_value"].startswith("Got '")


def test_cast_message_class_names_are_matched_when_bare() -> None:
    data = build_event(
        [
            {"value": "a0o$b cannot be cast to chf"},
            {"value": "ft70$a cannot be cast to l260"},
            {"value": "ymu cannot be cast to nbx"},
        ]
    )

    excs = Exceptions(data)
    assert excs.get_exception_class_names() == ["a0o$b", "chf", "ft70$a", "l260", "ymu", "nbx"]


def test_cast_message_class_names_are_matched_when_mixed() -> None:
    # A keep rule can preserve one class while R8 flattens the other.
    data = build_event(
        [
            {"value": "com.example.Foo cannot be cast to chf"},
            {"value": "chf cannot be cast to com.example.Foo"},
        ]
    )

    excs = Exceptions(data)
    class_names = excs.get_exception_class_names()

    assert class_names == ["com.example.Foo", "chf", "chf", "com.example.Foo"]


def test_deobfuscate_mixed_cast_message_class_names() -> None:
    # com.example.Foo is kept by a keep rule, so it has no mapping of its own.
    bare_target = {"value": "com.example.Foo cannot be cast to chf"}
    bare_source = {"value": "chf cannot be cast to com.example.Foo"}
    data = build_event([bare_target, bare_source])

    excs = Exceptions(data)

    excs.deobfuscate_and_save({"chf": "com.example.CastTarget"}, mapped_exceptions=[])

    assert bare_target["value"] == "com.example.Foo cannot be cast to com.example.CastTarget"
    assert bare_target["raw_value"] == "com.example.Foo cannot be cast to chf"
    assert bare_source["value"] == "com.example.CastTarget cannot be cast to com.example.Foo"
    assert bare_source["raw_value"] == "chf cannot be cast to com.example.Foo"


def test_deobfuscate_qualified_cast_message_class_names() -> None:
    # Fully qualified operands take the same rebuild path as bare ones, so an
    # unmapped operand is kept as-is rather than dropped.
    exc = {"value": "com.example.Foo cannot be cast to com.example.Bar"}
    data = build_event([exc])

    excs = Exceptions(data)

    excs.deobfuscate_and_save({"com.example.Bar": "com.example.MappedBar"}, mapped_exceptions=[])

    assert exc["value"] == "com.example.Foo cannot be cast to com.example.MappedBar"
    assert exc["raw_value"] == "com.example.Foo cannot be cast to com.example.Bar"


def test_deobfuscate_array_cast_message_class_names() -> None:
    exc = {"value": "a0o$b[][] cannot be cast to chf[]"}
    data = build_event([exc])

    excs = Exceptions(data)

    assert excs.get_exception_class_names() == ["a0o$b", "chf"]

    classes = {
        "a0o$b": "com.example.CastSource",
        "chf": "com.example.CastTarget",
    }
    excs.deobfuscate_and_save(classes, mapped_exceptions=[])

    assert exc["value"] == ("com.example.CastSource[][] cannot be cast to com.example.CastTarget[]")
    assert exc["raw_value"] == "a0o$b[][] cannot be cast to chf[]"


def test_cast_message_is_not_matched_in_prose() -> None:
    # A real cast message ends on the target class. Without that anchor, ordinary
    # prose that happens to contain the word "cast" would offer candidates.
    data = build_event(
        [
            {"value": "The provided value cannot be cast to a number, check the input"},
            {"value": "Failed to cast the vote before the deadline"},
        ]
    )

    excs = Exceptions(data)

    assert excs.get_exception_class_names() == []


def test_deobfuscate_bare_cast_message_class_names() -> None:
    mapped_both = {"value": "a0o$b cannot be cast to chf"}
    mapped_from = {"value": "a0o$b cannot be cast to missing"}
    mapped_to = {"value": "unknown cannot be cast to chf"}
    unmapped = {"value": "unknown cannot be cast to missing"}
    data = build_event([mapped_both, mapped_from, mapped_to, unmapped])

    excs = Exceptions(data)

    classes = {
        "a0o$b": "com.example.CastSource",
        "chf": "com.example.CastTarget",
    }

    excs.deobfuscate_and_save(classes, mapped_exceptions=[])

    assert mapped_both["value"] == (
        "com.example.CastSource cannot be cast to com.example.CastTarget"
    )
    assert mapped_both["raw_value"] == "a0o$b cannot be cast to chf"
    assert mapped_from["value"] == "com.example.CastSource cannot be cast to missing"
    assert mapped_from["raw_value"] == "a0o$b cannot be cast to missing"
    assert mapped_to["value"] == "unknown cannot be cast to com.example.CastTarget"
    assert mapped_to["raw_value"] == "unknown cannot be cast to chf"
    assert unmapped["value"] == "unknown cannot be cast to missing"
    assert "raw_value" not in unmapped


def test_deobfuscate_bare_cast_message_uses_atomic_reconstruction() -> None:
    # `to` is a valid obfuscated class name and also appears in the message
    # template. Reconstructing the value avoids replacing both occurrences.
    exc = {"value": "a0o$b cannot be cast to to"}
    data = build_event([exc])

    excs = Exceptions(data)

    classes = {
        "a0o$b": "com.example.FirstNavigationResult$Declared",
        "to": "com.example.SecondRegionResult",
    }

    excs.deobfuscate_and_save(classes, mapped_exceptions=[])

    assert exc["value"] == (
        "com.example.FirstNavigationResult$Declared cannot be cast to "
        "com.example.SecondRegionResult"
    )
    assert exc["raw_value"] == "a0o$b cannot be cast to to"


def test_deobfuscate_is_noop_when_no_classes_mapping() -> None:
    # Only value matches; no module/type entries and no classes mapping
    original = "Refs com.example.A and a.b$c$1 and 'o'"
    exc = {"value": original}
    data = build_event([exc])

    excs = Exceptions(data)

    # None mapping
    excs.deobfuscate_and_save(None, mapped_exceptions=[])
    assert exc["value"] == original
    assert "raw_value" not in exc

    # Empty mapping
    excs = Exceptions(build_event([{"value": original}]))
    exc = excs.get_processable_exceptions_with_values()[0][0]
    excs.deobfuscate_and_save({}, mapped_exceptions=[])
    assert exc["value"] == original
    assert "raw_value" not in exc
