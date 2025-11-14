from typing import int
import re

from sentry.lang.java.exceptions import Exceptions


def build_event(exceptions_values):
    return {"exception": {"values": exceptions_values}}


def test_get_processable_exceptions_filters_by_module_and_type():
    data = build_event(
        [
            {"type": "RuntimeException", "module": "java.lang", "value": "boom"},
            {"type": "IllegalStateException", "value": "oops"},
            {"module": "kotlin", "value": "meh"},
            {"value": "just text"},
        ]
    )

    excs = Exceptions(data)
    processable = excs.get_processable_exceptions()

    assert len(processable) == 1
    assert processable[0]["type"] == "RuntimeException"
    assert processable[0]["module"] == "java.lang"


def test_value_class_names_matches_fqcn_inner_and_quoted_multiple_values():
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


def test_deobfuscate_and_save_deobfuscates_types_and_values_multiple_values():
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


def test_deobfuscate_value_replaces_longest_tokens_first():
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


def test_deobfuscate_value_preserves_quotes_in_replacements():
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


def test_deobfuscate_is_noop_when_no_classes_mapping():
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
